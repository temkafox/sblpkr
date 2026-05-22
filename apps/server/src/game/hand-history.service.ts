import { Injectable } from '@nestjs/common';
import type { CoreGameState, ShowdownResult } from '@neonpoker/poker-core';
import { getNonFoldedSeatIndexes } from '@neonpoker/poker-core';
import type { SeatIndex } from '@neonpoker/poker-core';
import type { Card } from '@neonpoker/shared';
import type {
  HandHistoryActionKind,
  HandHistoryEntry,
  HandHistoryPayload,
  HandHistoryStreetSection,
  PlayerActionIntent,
  PublicSeatAction,
  Street,
} from '@neonpoker/shared';

import type { MutableInternalRoom } from '../room/room.types';

const NAME_COLORS = [
  'n-c',
  'n-m',
  'n-p',
  'n-v',
  'n-g',
  'n-a',
  'n-h',
] as const;

const SUIT_SYMBOL: Record<Card['s'], string> = {
  h: '♥',
  d: '♦',
  s: '♠',
  c: '♣',
};

const STREET_ORDER: readonly Street[] = [
  'PRE-FLOP',
  'FLOP',
  'TURN',
  'RIVER',
  'SHOWDOWN',
];

type StoredEntry = HandHistoryEntry;

const MAX_HISTORY_ENTRIES = 200;

type RoomHandHistory = {
  handId: string | null;
  handNumber: number;
  entries: StoredEntry[];
  nextSeq: number;
  revision: number;
};

@Injectable()
export class HandHistoryService {
  private readonly byRoom = new Map<string, RoomHandHistory>();

  clearRoom(roomId: string): void {
    this.byRoom.delete(roomId);
  }

  buildPayload(roomId: string): HandHistoryPayload {
    const room = this.byRoom.get(roomId);
    if (room == null) {
      return {
        roomId,
        handId: null,
        handNumber: 0,
        revision: 0,
        streets: [],
      };
    }

    return {
      roomId,
      handId: room.handId,
      handNumber: room.handNumber,
      revision: room.revision,
      streets: groupEntriesByStreet(room.entries),
    };
  }

  onHandStarted(room: MutableInternalRoom, state: CoreGameState): void {
    const hand = state.hand;
    if (hand == null) return;

    const roomId = room.roomId;
    const store = this.ensureRoom(roomId);
    store.handId = hand.handId;
    store.handNumber += 1;
    store.entries = [];
    store.nextSeq = 0;

    this.push(
      store,
      'PRE-FLOP',
      `Hand #${store.handNumber} started`,
      {
        actionKind: 'hand_start',
      },
    );

    const sbSeat = state.table.smallBlindSeatIndex;
    const bbSeat = state.table.bigBlindSeatIndex;
    this.appendPublicAction(room, store, state, sbSeat, hand.lastPublicActionsBySeat[sbSeat]);
    this.appendPublicAction(room, store, state, bbSeat, hand.lastPublicActionsBySeat[bbSeat]);
  }

  onPlayerAction(
    room: MutableInternalRoom,
    state: CoreGameState,
    seatIndex: SeatIndex,
    action: PlayerActionIntent,
  ): void {
    const hand = state.hand;
    if (hand == null) return;

    const store = this.byRoom.get(room.roomId);
    if (store == null || store.handId !== hand.handId) return;

    const publicAction = hand.lastPublicActionsBySeat[seatIndex];
    if (publicAction != null) {
      this.appendPublicAction(room, store, state, seatIndex, publicAction);
      return;
    }

    this.appendFromIntent(room, store, state, seatIndex, action);
  }

  onProgress(
    room: MutableInternalRoom,
    before: CoreGameState,
    after: CoreGameState,
    showdownResult: ShowdownResult | null,
    isFoldWin: boolean,
  ): void {
    const handAfter = after.hand;
    if (handAfter == null) return;

    const store = this.byRoom.get(room.roomId);
    if (store == null || store.handId !== handAfter.handId) return;

    const handBefore = before.hand;
    const boardBefore = handBefore?.boardCards.length ?? 0;
    const boardAfter = handAfter.boardCards.length;
    const cards = handAfter.boardCards;

    if (boardAfter >= 3 && boardBefore < 3) {
      this.push(store, 'FLOP', streetLabel('FLOP'), { actionKind: 'street' });
      this.push(store, 'FLOP', boardLine('FLOP', cards.slice(0, 3)), {
        actionKind: 'board',
        boardCards: cards.slice(0, 3).map((c) => ({ r: c.r, s: c.s })),
      });
    }
    if (boardAfter >= 4 && boardBefore < 4) {
      this.push(store, 'TURN', streetLabel('TURN'), { actionKind: 'street' });
      this.push(store, 'TURN', boardLine('TURN', cards.slice(3, 4)), {
        actionKind: 'board',
        boardCards: cards.slice(3, 4).map((c) => ({ r: c.r, s: c.s })),
      });
    }
    if (boardAfter >= 5 && boardBefore < 5) {
      this.push(store, 'RIVER', streetLabel('RIVER'), { actionKind: 'street' });
      this.push(store, 'RIVER', boardLine('RIVER', cards.slice(4, 5)), {
        actionKind: 'board',
        boardCards: cards.slice(4, 5).map((c) => ({ r: c.r, s: c.s })),
      });
    }

    if (handAfter.street === 'SHOWDOWN' && handBefore?.street !== 'SHOWDOWN') {
      this.push(store, 'SHOWDOWN', streetLabel('SHOWDOWN'), {
        actionKind: 'street',
      });
    }

    if (handAfter.isComplete && !handBefore?.isComplete) {
      this.push(store, 'SHOWDOWN', 'Hand complete', {
        actionKind: 'hand_complete',
      });
      this.appendWinners(room, store, after, showdownResult, isFoldWin);
    }
  }

  onTimeoutAction(
    room: MutableInternalRoom,
    state: CoreGameState,
    seatIndex: SeatIndex,
    kind: 'check' | 'fold',
  ): void {
    const store = this.ensureRoom(room.roomId);
    const nickname = nicknameForSeat(room, seatIndex);
    const cls = colorForSeat(seatIndex);
    const street = (state.hand?.street ?? 'PRE-FLOP') as Street;
    const verb = kind === 'check' ? 'checked' : 'folded';
    this.push(store, street, `${nickname} timed out — ${verb}`, {
      nickname,
      nameColor: cls,
      actionKind: kind === 'check' ? 'timeout_check' : 'timeout_fold',
    });
  }

  onRebuy(
    room: MutableInternalRoom,
    seatIndex: SeatIndex,
    chips: number,
  ): void {
    const store = this.ensureRoom(room.roomId);

    const nickname = nicknameForSeat(room, seatIndex);
    const cls = colorForSeat(seatIndex);
    this.push(
      store,
      'PRE-FLOP',
      `${nickname} rebuy $${chips}`,
      {
        nickname,
        nameColor: cls,
        actionKind: 'rebuy',
        amount: chips,
      },
    );
  }

  private ensureRoom(roomId: string): RoomHandHistory {
    let store = this.byRoom.get(roomId);
    if (store == null) {
      store = {
        handId: null,
        handNumber: 0,
        entries: [],
        nextSeq: 0,
        revision: 0,
      };
      this.byRoom.set(roomId, store);
    }
    return store;
  }

  private appendPublicAction(
    room: MutableInternalRoom,
    store: RoomHandHistory,
    state: CoreGameState,
    seatIndex: SeatIndex,
    action: PublicSeatAction | undefined,
  ): void {
    if (action == null) return;

    const nickname = nicknameForSeat(room, seatIndex);
    const cls = colorForSeat(seatIndex);
    const street = (state.hand?.street ?? 'PRE-FLOP') as Street;
    const { text, amount, actionKind } = formatPublicAction(nickname, action);

    this.push(store, street, text, {
      nickname,
      nameColor: cls,
      actionKind,
      amount,
    });
  }

  private appendFromIntent(
    room: MutableInternalRoom,
    store: RoomHandHistory,
    state: CoreGameState,
    seatIndex: SeatIndex,
    intent: PlayerActionIntent,
  ): void {
    const nickname = nicknameForSeat(room, seatIndex);
    const cls = colorForSeat(seatIndex);
    const street = (state.hand?.street ?? 'PRE-FLOP') as Street;
    const { text, amount, actionKind } = formatIntent(nickname, intent);

    this.push(store, street, text, {
      nickname,
      nameColor: cls,
      actionKind,
      amount,
    });
  }

  private appendWinners(
    room: MutableInternalRoom,
    store: RoomHandHistory,
    state: CoreGameState,
    showdownResult: ShowdownResult | null,
    isFoldWin: boolean,
  ): void {
    if (showdownResult == null) {
      if (!isFoldWin) {
        return;
      }
      for (const seatIndex of getNonFoldedSeatIndexes(state)) {
        const nickname = nicknameForSeat(room, seatIndex);
        const cls = colorForSeat(seatIndex);
        this.push(store, 'SHOWDOWN', `${nickname} wins`, {
          nickname,
          nameColor: cls,
          actionKind: 'winner',
        });
      }
      return;
    }

    const awards = aggregateAwards(showdownResult);
    for (const [seatKey, amount] of Object.entries(awards)) {
      if (amount <= 0) continue;
      const seatIndex = Number(seatKey);
      const nickname = nicknameForSeat(room, seatIndex);
      const cls = colorForSeat(seatIndex);
      this.push(store, 'SHOWDOWN', `${nickname} wins $${amount}`, {
        nickname,
        nameColor: cls,
        actionKind: 'winner',
        amount,
      });
    }
  }

  private push(
    store: RoomHandHistory,
    street: Street,
    text: string,
    meta: Omit<HandHistoryEntry, 'seq' | 'street' | 'text'> = {},
  ): void {
    store.entries.push(
      Object.freeze({
        seq: store.nextSeq++,
        street,
        text,
        ...meta,
      }),
    );
    store.revision += 1;
    this.trimEntries(store);
  }

  private trimEntries(store: RoomHandHistory): void {
    if (store.entries.length <= MAX_HISTORY_ENTRIES) {
      return;
    }
    store.entries = store.entries.slice(-MAX_HISTORY_ENTRIES);
    store.revision += 1;
  }
}

function groupEntriesByStreet(entries: readonly StoredEntry[]): HandHistoryStreetSection[] {
  const byStreet = new Map<Street, StoredEntry[]>();
  for (const entry of entries) {
    const list = byStreet.get(entry.street) ?? [];
    list.push(entry);
    byStreet.set(entry.street, list);
  }

  return STREET_ORDER.filter((s) => byStreet.has(s)).map((street) => {
    const section: HandHistoryStreetSection = {
      street,
      entries: [...byStreet.get(street)!],
    };
    return Object.freeze(section);
  });
}

function nicknameForSeat(room: MutableInternalRoom, seatIndex: SeatIndex): string {
  const member =
    room.players.find((p) => p.seatIndex === seatIndex) ??
    room.players[seatIndex];
  return member?.nickname ?? `Seat ${seatIndex}`;
}

function colorForSeat(seatIndex: SeatIndex): string {
  return NAME_COLORS[seatIndex % NAME_COLORS.length]!;
}

function formatPublicAction(
  nickname: string,
  action: PublicSeatAction,
): {
  text: string;
  amount?: number;
  actionKind: HandHistoryActionKind;
} {
  switch (action.kind) {
    case 'post_sb':
      return {
        text: `${nickname} posts small blind $${action.amount ?? 0}`,
        amount: action.amount,
        actionKind: 'post_sb',
      };
    case 'post_bb':
      return {
        text: `${nickname} posts big blind $${action.amount ?? 0}`,
        amount: action.amount,
        actionKind: 'post_bb',
      };
    case 'fold':
      return { text: `${nickname} folds`, actionKind: 'fold' };
    case 'check':
      return { text: `${nickname} checks`, actionKind: 'check' };
    case 'call':
      return {
        text: `${nickname} calls $${action.amount ?? 0}`,
        amount: action.amount,
        actionKind: 'call',
      };
    case 'raise':
      return {
        text: `${nickname} raises to $${action.amount ?? 0}`,
        amount: action.amount,
        actionKind: 'raise',
      };
    case 'allin':
      return {
        text: `${nickname} is all-in${
          action.amount != null ? ` $${action.amount}` : ''
        }`,
        amount: action.amount,
        actionKind: 'allin',
      };
    default:
      return { text: `${nickname} acts`, actionKind: 'check' };
  }
}

function formatIntent(
  nickname: string,
  intent: PlayerActionIntent,
): {
  text: string;
  amount?: number;
  actionKind: HandHistoryActionKind;
} {
  switch (intent.kind) {
    case 'fold':
      return { text: `${nickname} folds`, actionKind: 'fold' };
    case 'check':
      return { text: `${nickname} checks`, actionKind: 'check' };
    case 'call':
      return { text: `${nickname} calls`, actionKind: 'call' };
    case 'raise':
      return {
        text: `${nickname} raises to $${intent.amount}`,
        amount: intent.amount,
        actionKind: 'raise',
      };
    case 'allin':
      return { text: `${nickname} is all-in`, actionKind: 'allin' };
    default:
      return { text: `${nickname} acts`, actionKind: 'check' };
  }
}

function streetLabel(street: Street): string {
  switch (street) {
    case 'FLOP':
      return 'Flop';
    case 'TURN':
      return 'Turn';
    case 'RIVER':
      return 'River';
    case 'SHOWDOWN':
      return 'Showdown';
    default:
      return street;
  }
}

function boardLine(street: Street, cards: readonly Card[]): string {
  const label =
    street === 'FLOP'
      ? 'Flop'
      : street === 'TURN'
        ? 'Turn'
        : street === 'RIVER'
          ? 'River'
          : 'Board';
  return `${label}: ${cards.map(formatCard).join(' ')}`;
}

function formatCard(card: Card): string {
  return `${card.r}${SUIT_SYMBOL[card.s]}`;
}

function aggregateAwards(result: ShowdownResult): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  for (const pr of result.potResults) {
    for (const [seatKey, amount] of Object.entries(pr.awardedAmountsBySeatIndex)) {
      if (amount == null || amount <= 0) continue;
      out[seatKey] = (out[seatKey] ?? 0) + amount;
    }
  }
  return out;
}

/** Guard: payload must not leak private engine fields. */
export function handHistoryPayloadIsPublic(payload: HandHistoryPayload): boolean {
  const json = JSON.stringify(payload);
  return (
    !json.includes('"deck"') &&
    !json.includes('"holeCards"') &&
    !json.includes('"playersById"')
  );
}
