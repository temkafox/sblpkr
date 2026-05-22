import type { CoreGameState } from '@neonpoker/poker-core';
import {
  getAvailableActions,
  getNonFoldedSeatIndexes,
  getPlayerAtSeat,
  syncPotsFromCommitments,
} from '@neonpoker/poker-core';
import type { SeatIndex } from '@neonpoker/poker-core';
import type {
  AvailableActions,
  Card,
  HandEndKind,
  HandResultPayload,
  PublicGameState,
  PlayerGameState,
  PublicSeatAction,
  WireSeatView,
} from '@neonpoker/shared';

import type { MutableInternalRoom } from '../room/room.types';
import { computeHandResultPayload } from './hand-result';

type NicknameLookup = ReadonlyMap<string, string>;

function nicknameByPlayerId(room: MutableInternalRoom | null): NicknameLookup {
  const map = new Map<string, string>();
  if (room == null) return map;
  for (const p of room.players) {
    map.set(p.playerId, p.nickname);
  }
  return map;
}

function nicknameForSeat(
  seat: { readonly playerId: string | null; readonly seatIndex: number },
  room: MutableInternalRoom | null,
  nicknames: NicknameLookup,
): string | null {
  if (seat.playerId == null) return null;
  const byId = nicknames.get(seat.playerId);
  if (byId != null && byId.length > 0) return byId;
  const member = room?.players.find((p) => p.playerId === seat.playerId);
  if (member?.nickname) return member.nickname;
  const byJoinOrder = room?.players[seat.seatIndex];
  if (byJoinOrder?.playerId === seat.playerId && byJoinOrder.nickname) {
    return byJoinOrder.nickname;
  }
  return null;
}

function mapPot(state: CoreGameState): PublicGameState['pot'] {
  const hand = state.hand;
  if (hand == null) {
    return { total: 0, sidePots: [] };
  }

  const pots = hand.pots;
  return {
    total: pots.total,
    sidePots: pots.sidePots.map((sp) => ({
      amount: sp.amount,
      eligibleSeatIndexes: [...sp.eligibleSeatIndexes],
    })),
  };
}

/** True when the completed hand ended with a single remaining contestant (fold-down). */
export function isFoldWinHand(state: CoreGameState): boolean {
  const hand = state.hand;
  if (hand == null || !hand.isComplete) {
    return false;
  }
  return getNonFoldedSeatIndexes(syncPotsFromCommitments(state)).length === 1;
}

function handEndKindForState(state: CoreGameState): HandEndKind | null {
  const hand = state.hand;
  if (hand == null || !hand.isComplete) {
    return null;
  }
  return isFoldWinHand(state) ? 'FOLD_WIN' : 'SHOWDOWN';
}

function shouldRevealHoleCardsAtSeat(
  state: CoreGameState,
  seatIndex: SeatIndex,
  viewerSeatIndex: SeatIndex | null,
): boolean {
  if (viewerSeatIndex === seatIndex) {
    return true;
  }

  const hand = state.hand;
  if (hand == null || !hand.isComplete || isFoldWinHand(state)) {
    return false;
  }

  const player = getPlayerAtSeat(state, seatIndex);
  return player != null && !player.hasFolded && player.holeCards.length > 0;
}

function isHandComplete(state: CoreGameState): boolean {
  const hand = state.hand;
  return hand != null && hand.isComplete;
}

function winnerSeatIndexesForState(
  state: CoreGameState,
  handResult: HandResultPayload | null = null,
): readonly number[] {
  const hand = state.hand;
  if (hand == null || !hand.isComplete) {
    return Object.freeze([]);
  }
  if (handResult != null && handResult.handId === hand.handId) {
    return Object.freeze(handResult.winnerSeatIndexes);
  }
  if (isFoldWinHand(state)) {
    return Object.freeze(getNonFoldedSeatIndexes(syncPotsFromCommitments(state)));
  }
  const payload = computeHandResultPayload(state);
  return Object.freeze(payload?.winnerSeatIndexes ?? []);
}

function lastActionForSeat(
  state: CoreGameState,
  seatIndex: SeatIndex,
): PublicSeatAction | null {
  const hand = state.hand;
  if (hand == null) {
    return null;
  }
  return hand.lastPublicActionsBySeat[seatIndex] ?? null;
}

function holeCardsForSeat(
  state: CoreGameState,
  seatIndex: SeatIndex,
  viewerSeatIndex: SeatIndex | null,
): { holeCards: readonly Card[] | null; holeCardCount: number | null } {
  const player = getPlayerAtSeat(state, seatIndex);
  if (player == null || player.holeCards.length === 0) {
    return { holeCards: null, holeCardCount: null };
  }

  const count = player.holeCards.length;

  if (shouldRevealHoleCardsAtSeat(state, seatIndex, viewerSeatIndex)) {
    return {
      holeCards: [...player.holeCards],
      holeCardCount: count,
    };
  }

  if (!isHandComplete(state)) {
    return { holeCards: null, holeCardCount: count };
  }

  return { holeCards: null, holeCardCount: count };
}

function buildSeatViews(
  state: CoreGameState,
  room: MutableInternalRoom | null,
  viewerSeatIndex: SeatIndex | null,
  winnerSeatIndexes: readonly number[],
): WireSeatView[] {
  const nicknames = nicknameByPlayerId(room);
  const winnerSet = new Set(winnerSeatIndexes);
  const connectionByPlayerId = new Map<string, WireSeatView['connectionStatus']>();
  if (room != null) {
    for (const member of room.players) {
      connectionByPlayerId.set(member.playerId, member.connectionStatus);
    }
  }

  return state.table.seats.map((seat) => {
      const runtime = getPlayerAtSeat(state, seat.seatIndex);
      const { holeCards, holeCardCount } = holeCardsForSeat(
        state,
        seat.seatIndex,
        viewerSeatIndex,
      );

      return {
        seatIndex: seat.seatIndex,
        playerId: seat.playerId,
        nickname: nicknameForSeat(seat, room, nicknames),
        stack: runtime?.chips ?? 0,
        currentBet: runtime?.currentBet ?? 0,
        hasFolded: runtime?.hasFolded ?? false,
        isAllIn: runtime?.isAllIn ?? false,
        isSittingOut: runtime?.isSittingOut ?? false,
        lastAction: lastActionForSeat(state, seat.seatIndex),
        isWinner: winnerSet.has(seat.seatIndex),
        connectionStatus:
          seat.playerId != null
            ? (connectionByPlayerId.get(seat.playerId) ?? 'connected')
            : undefined,
        holeCards:
          holeCards != null ? holeCards.map((c) => ({ r: c.r, s: c.s })) : null,
        holeCardCount,
      };
    });
}

function rebuyMetaForViewer(
  room: MutableInternalRoom | null,
  state: CoreGameState,
  viewerSeatIndex: SeatIndex,
): {
  rebuyCount: number;
  maxRebuysPerPlayer: number | null;
  canRebuy: boolean;
  rebuyUnavailableReason?: string;
} | null {
  if (room == null) {
    return null;
  }
  const member = room.players[viewerSeatIndex];
  if (member == null) {
    return null;
  }

  const maxRebuys = room.settings.maxRebuysPerPlayer;
  const rebuyCount = member.rebuyCount;
  const playerId = state.table.seats[viewerSeatIndex]?.playerId;
  const runtime =
    playerId != null ? state.playersById[playerId] : undefined;
  const hand = state.hand;

  if (maxRebuys === 0) {
    return {
      rebuyCount,
      maxRebuysPerPlayer: 0,
      canRebuy: false,
      rebuyUnavailableReason: 'Rebuys disabled',
    };
  }
  if (maxRebuys != null && rebuyCount >= maxRebuys) {
    return {
      rebuyCount,
      maxRebuysPerPlayer: maxRebuys,
      canRebuy: false,
      rebuyUnavailableReason: 'Rebuy limit reached',
    };
  }
  if (hand != null && !hand.isComplete) {
    return {
      rebuyCount,
      maxRebuysPerPlayer: maxRebuys,
      canRebuy: false,
      rebuyUnavailableReason: 'Hand in progress',
    };
  }
  if (runtime != null && runtime.chips > 0) {
    return {
      rebuyCount,
      maxRebuysPerPlayer: maxRebuys,
      canRebuy: false,
      rebuyUnavailableReason: 'Still has chips',
    };
  }

  return {
    rebuyCount,
    maxRebuysPerPlayer: maxRebuys,
    canRebuy: true,
  };
}

function baseView(
  state: CoreGameState,
  room: MutableInternalRoom | null,
  viewerSeatIndex: SeatIndex | null,
  handResult: HandResultPayload | null = null,
): PublicGameState {
  const hand = state.hand;
  const winners = winnerSeatIndexesForState(state, handResult);

  return {
    tableId: state.table.tableId,
    maxSeats: state.table.maxSeats,
    street: hand?.street ?? null,
    boardCards: hand ? [...hand.boardCards] : [],
    pot: mapPot(state),
    dealerSeatIndex: hand != null ? state.table.dealerSeatIndex : null,
    smallBlindSeatIndex: hand != null ? state.table.smallBlindSeatIndex : null,
    bigBlindSeatIndex: hand != null ? state.table.bigBlindSeatIndex : null,
    activeSeatIndex: state.table.activeSeatIndex,
    seats: [...buildSeatViews(state, room, viewerSeatIndex, winners)],
    handId: hand?.handId ?? null,
    handComplete: hand?.isComplete ?? false,
    showdownReady: hand?.showdownReady ?? false,
    handEndKind: handEndKindForState(state),
    winnerSeatIndexes: hand?.isComplete ? [...winners] : undefined,
    actionDeadlineAt:
      room?.actionDeadlineAt != null
        ? new Date(room.actionDeadlineAt).toISOString()
        : null,
    actionTimeoutSeconds: room?.settings.actionTimeoutSeconds,
  };
}

/** Observer-safe snapshot — no hole card faces for any seat. */

export function toPublicGameState(
  state: CoreGameState,
  room: MutableInternalRoom | null = null,
  handResult: HandResultPayload | null = null,
): PublicGameState {
  return baseView(state, room, null, handResult);
}

/** Per-viewer snapshot — only the viewer seat includes hole card faces. */

export function toPlayerGameState(
  state: CoreGameState,
  viewerSeatIndex: SeatIndex,
  room: MutableInternalRoom | null = null,
  handResult: HandResultPayload | null = null,
): PlayerGameState {
  const base = baseView(state, room, viewerSeatIndex, handResult);

  let availableActions: AvailableActions | undefined;
  const hand = state.hand;
  if (
    hand != null &&
    !hand.isComplete &&
    !hand.showdownReady &&
    state.table.activeSeatIndex === viewerSeatIndex
  ) {
    const core = getAvailableActions(state, viewerSeatIndex);
    availableActions = Object.freeze({ ...core });
  }

  const rebuyMeta = rebuyMetaForViewer(room, state, viewerSeatIndex);

  return {
    ...base,
    viewerSeatIndex,
    ...(availableActions != null ? { availableActions: { ...availableActions } } : {}),
    ...(rebuyMeta != null ? rebuyMeta : {}),
  };
}

/** Waiting-table snapshot — roster-aligned stacks, no active hand UI fields. */
export function toIdlePlayerGameState(
  state: CoreGameState,
  viewerSeatIndex: SeatIndex,
  room: MutableInternalRoom | null = null,
): PlayerGameState {
  const view = toPlayerGameState(state, viewerSeatIndex, room);
  return {
    ...view,
    street: null,
    boardCards: [],
    pot: { total: 0, sidePots: [] },
    dealerSeatIndex: null,
    smallBlindSeatIndex: null,
    bigBlindSeatIndex: null,
    activeSeatIndex: null,
    handId: null,
    handComplete: false,
    showdownReady: false,
    handEndKind: null,
    winnerSeatIndexes: undefined,
    seats: view.seats.map((seat) => ({
      ...seat,
      currentBet: 0,
      hasFolded: false,
      isAllIn: false,
      lastAction: null,
      isWinner: false,
      holeCards: null,
      holeCardCount: null,
    })),
  };
}

/** Returns true if payload contains private engine fields (guard for tests). */

export function containsPrivateEngineFields(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  if ('deck' in obj || 'playersById' in obj) return true;
  if ('hand' in obj && obj.hand != null && typeof obj.hand === 'object') {
    const hand = obj.hand as Record<string, unknown>;
    if ('deck' in hand) return true;
  }
  return false;
}
