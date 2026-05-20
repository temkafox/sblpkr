import type { CoreGameState } from '@neonpoker/poker-core';
import { getAvailableActions, getPlayerAtSeat } from '@neonpoker/poker-core';
import type { SeatIndex } from '@neonpoker/poker-core';
import type {
  AvailableActions,
  Card,
  PublicGameState,
  PlayerGameState,
  WireSeatView,
} from '@neonpoker/shared';

import type { MutableInternalRoom } from '../room/room.types';

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

  if (viewerSeatIndex === seatIndex) {
    return {
      holeCards: [...player.holeCards],
      holeCardCount: count,
    };
  }

  return { holeCards: null, holeCardCount: count };
}

function buildSeatViews(
  state: CoreGameState,
  room: MutableInternalRoom | null,
  viewerSeatIndex: SeatIndex | null,
): WireSeatView[] {
  const nicknames = nicknameByPlayerId(room);

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
        holeCards:
          holeCards != null ? holeCards.map((c) => ({ r: c.r, s: c.s })) : null,
        holeCardCount,
      };
    });
}

function baseView(
  state: CoreGameState,
  room: MutableInternalRoom | null,
  viewerSeatIndex: SeatIndex | null,
): PublicGameState {
  const hand = state.hand;

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
    seats: [...buildSeatViews(state, room, viewerSeatIndex)],
    handId: hand?.handId ?? null,
    handComplete: hand?.isComplete ?? false,
    showdownReady: hand?.showdownReady ?? false,
  };
}

/** Observer-safe snapshot — no hole card faces for any seat. */

export function toPublicGameState(
  state: CoreGameState,
  room: MutableInternalRoom | null = null,
): PublicGameState {
  return baseView(state, room, null);
}

/** Per-viewer snapshot — only the viewer seat includes hole card faces. */

export function toPlayerGameState(
  state: CoreGameState,
  viewerSeatIndex: SeatIndex,
  room: MutableInternalRoom | null = null,
): PlayerGameState {
  const base = baseView(state, room, viewerSeatIndex);

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

  return {
    ...base,
    ...(availableActions != null ? { availableActions: { ...availableActions } } : {}),
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
    seats: view.seats.map((seat) => ({
      ...seat,
      currentBet: 0,
      hasFolded: false,
      isAllIn: false,
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
