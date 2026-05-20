import type { CoreGameState, HandState, SeatIndex } from '@neonpoker/poker-core';
import {
  advanceTurnAfterAction,
  createInitialPlayerState,
  getPlayerAtSeat,
  isBettingRoundComplete,
  needsToAct,
} from '@neonpoker/poker-core';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import type { MutableInternalRoom } from '../room/room.types';

function appendActedSeat(
  hand: HandState,
  seat: SeatIndex,
): readonly SeatIndex[] {
  if (hand.actedSeatIndexes.includes(seat)) {
    return hand.actedSeatIndexes;
  }
  return Object.freeze([...hand.actedSeatIndexes, seat]);
}

function mergeHandPotTotal(state: CoreGameState): CoreGameState {
  const hand = state.hand;
  if (hand == null) {
    return state;
  }

  let total = 0;
  for (const pid of Object.keys(state.playersById)) {
    total += state.playersById[pid]!.totalCommitted;
  }

  return Object.freeze({
    ...state,
    hand: Object.freeze({
      ...hand,
      pots: Object.freeze({
        ...hand.pots,
        total,
      }),
    }),
  });
}

function clonePlayers(
  playersById: Readonly<Record<string, CoreGameState['playersById'][string]>>,
): Record<string, CoreGameState['playersById'][string]> {
  const out: Record<string, CoreGameState['playersById'][string]> =
    Object.create(null);
  for (const k of Object.keys(playersById)) {
    out[k] = playersById[k]!;
  }
  return out;
}

/** Fold a seated player without turn validation (disconnect / leave mid-hand). */
export function forceFoldSeat(
  state: CoreGameState,
  seatIndex: SeatIndex,
): CoreGameState {
  const hand = state.hand;
  if (hand == null || hand.isComplete) {
    return state;
  }

  const p = getPlayerAtSeat(state, seatIndex);
  if (p == null || p.hasFolded) {
    return state;
  }

  const players = clonePlayers(state.playersById);
  players[p.playerId] = Object.freeze({ ...p, hasFolded: true });

  let next: CoreGameState = Object.freeze({
    ...state,
    playersById: Object.freeze(players),
    hand: Object.freeze({
      ...hand,
      actedSeatIndexes: appendActedSeat(hand, seatIndex),
    }),
  });

  next = mergeHandPotTotal(next);

  if (isBettingRoundComplete(next)) {
    return Object.freeze({
      ...next,
      table: Object.freeze({
        ...next.table,
        activeSeatIndex: null,
      }),
    });
  }

  return advanceTurnAfterAction(next);
}

/** Rotate action if the current seat can no longer act (e.g. forced fold on disconnect). */
export function unstuckActiveSeat(state: CoreGameState): CoreGameState {
  const hand = state.hand;
  if (hand == null || hand.isComplete) {
    return state;
  }

  let g = state;
  for (let guard = 0; guard < g.table.maxSeats; guard++) {
    const active = g.table.activeSeatIndex;
    if (active == null) {
      break;
    }
    if (needsToAct(g, active)) {
      break;
    }
    const advanced = advanceTurnAfterAction(g);
    if (advanced === g) {
      break;
    }
    g = advanced;
  }
  return g;
}

/**
 * Reconcile core table seats with the room roster.
 * Preserves chip stacks for returning players; vacates departed seats.
 */
export function syncTableToRoom(
  room: MutableInternalRoom,
  existing: CoreGameState,
): CoreGameState {
  const rosterIds = new Set(room.players.map((p) => p.playerId));
  const hand = existing.hand;
  const playersById = clonePlayers(existing.playersById);

  for (let i = 0; i < room.players.length; i++) {
    const member = room.players[i]!;
    const prior = playersById[member.playerId];
    if (prior == null) {
      playersById[member.playerId] = createInitialPlayerState({
        playerId: member.playerId,
        seatIndex: i,
        startingChips: DEFAULT_STARTING_CHIPS,
      });
    } else {
      playersById[member.playerId] = Object.freeze({
        ...prior,
        seatIndex: i,
      });
    }
  }

  for (const pid of Object.keys(playersById)) {
    if (rosterIds.has(pid)) {
      continue;
    }
    if (hand == null || hand.isComplete) {
      delete playersById[pid];
      continue;
    }
    const p = playersById[pid]!;
    if (!p.hasFolded) {
      playersById[pid] = Object.freeze({ ...p, hasFolded: true });
    }
  }

  const seats = existing.table.seats.map((s) => {
    const member = room.players[s.seatIndex];
    return Object.freeze({
      seatIndex: s.seatIndex,
      playerId: member?.playerId ?? null,
    });
  });

  const table = Object.freeze({
    ...existing.table,
    tableId: room.roomId,
    smallBlind: existing.table.smallBlind || DEFAULT_SMALL_BLIND,
    bigBlind: existing.table.bigBlind || DEFAULT_BIG_BLIND,
    seats: Object.freeze(seats),
  });

  return applySeatEligibility(
    Object.freeze({
      table,
      hand: existing.hand,
      playersById: Object.freeze(playersById),
    }),
  );
}

/** Players with chips > 0 who are seated and not sitting out. */
export function countEligiblePlayers(state: CoreGameState): number {
  let count = 0;
  for (const seat of state.table.seats) {
    const p = getPlayerAtSeat(state, seat.seatIndex);
    if (p != null && p.chips > 0 && !p.isSittingOut) {
      count += 1;
    }
  }
  return count;
}

/** Mark zero-stack (and negative) players sitting out; clear sit-out when they have chips. */
export function applySeatEligibility(state: CoreGameState): CoreGameState {
  const playersById = clonePlayers(state.playersById);

  for (const pid of Object.keys(playersById)) {
    const p = playersById[pid]!;
    const sittingOut = p.chips <= 0;
    if (p.isSittingOut === sittingOut) {
      continue;
    }
    playersById[pid] = Object.freeze({
      ...p,
      isSittingOut: sittingOut,
    });
  }

  return Object.freeze({
    ...state,
    playersById: Object.freeze(playersById),
  });
}

/** Fold every seated player who is no longer in the room roster. */
export function foldDepartedPlayers(
  state: CoreGameState,
  room: MutableInternalRoom,
): CoreGameState {
  const rosterIds = new Set(room.players.map((p) => p.playerId));
  let g = state;

  for (const seat of g.table.seats) {
    const pid = seat.playerId;
    if (pid == null || rosterIds.has(pid)) {
      continue;
    }
    g = forceFoldSeat(g, seat.seatIndex);
  }

  return unstuckActiveSeat(g);
}
