import type { HandState } from '../domain/hand-state';

import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { SeatIndex } from '../domain/seat';
import { getPlayerAtSeat } from './seat-utils';

export function appendActedSeat(
  hand: HandState,
  seat: SeatIndex,
): readonly SeatIndex[] {
  if (hand.actedSeatIndexes.includes(seat)) {
    return hand.actedSeatIndexes;
  }
  return Object.freeze([...hand.actedSeatIndexes, seat]);
}

export function resetActedAfterAggression(seat: SeatIndex): readonly SeatIndex[] {
  return Object.freeze([seat]);
}

/** Dealt into the current hand and not folded (includes all-in at 0 chips). */
export function isContestantInCurrentHand(
  player: PlayerRuntimeState | null,
): player is PlayerRuntimeState {
  return player != null && !player.hasFolded;
}

export function getContestantSeatIndexes(state: CoreGameState): SeatIndex[] {
  return getNonFoldedSeatIndexes(state);
}

/** Players who have not folded this hand (includes all-in; sitting out is not a fold). */

export function getNonFoldedSeatIndexes(state: CoreGameState): SeatIndex[] {
  const out: SeatIndex[] = [];
  for (const s of state.table.seats) {
    const p = getPlayerAtSeat(state, s.seatIndex);
    if (p != null && !p.hasFolded) {
      out.push(s.seatIndex);
    }
  }
  return out;
}

/** Non-folded players who may still bet (chips > 0 and not all-in). */
export function getActorsWhoCanBetSeatIndexes(state: CoreGameState): SeatIndex[] {
  const out: SeatIndex[] = [];
  for (const seat of getNonFoldedSeatIndexes(state)) {
    const p = getPlayerAtSeat(state, seat);
    if (p != null && !p.isAllIn && p.chips > 0) {
      out.push(seat);
    }
  }
  return out;
}

/** True when at least two non-folded players can still take betting actions. */
export function canContinueBetting(state: CoreGameState): boolean {
  return getActorsWhoCanBetSeatIndexes(state).length >= 2;
}

/** In the current hand: may take a betting action (not folded, not all-in, has chips to act). */
export function canActNow(state: CoreGameState, seat: SeatIndex): boolean {
  return needsToAct(state, seat);
}

export function needsToAct(state: CoreGameState, seat: SeatIndex): boolean {
  const hand = state.hand;
  if (hand == null || hand.isComplete) return false;
  if (hand.showdownReady || hand.street === 'SHOWDOWN') return false;

  const p = getPlayerAtSeat(state, seat);
  if (p == null || p.hasFolded || p.isAllIn) return false;

  if (p.currentBet < hand.currentBet) return true;

  if (!hand.actedSeatIndexes.includes(seat)) return true;

  return false;
}

export function anyNeedsToAct(state: CoreGameState): boolean {
  for (const s of state.table.seats) {
    if (needsToAct(state, s.seatIndex)) return true;
  }
  return false;
}

export function sumTotalCommitted(state: CoreGameState): number {
  let sum = 0;
  for (const pid of Object.keys(state.playersById)) {
    sum += state.playersById[pid]!.totalCommitted;
  }
  return sum;
}

export function mergeHandPotTotal(state: CoreGameState): CoreGameState {
  if (state.hand == null) return state;

  const pots = Object.freeze({
    ...state.hand.pots,
    total: sumTotalCommitted(state),
  });

  const hand = Object.freeze({
    ...state.hand,
    pots,
  });

  return Object.freeze({ ...state, hand });
}

export function isBettingRoundComplete(state: CoreGameState): boolean {
  const hand = state.hand;
  if (hand == null || hand.isComplete) return false;
  if (hand.showdownReady || hand.street === 'SHOWDOWN') return false;

  const contestantSeats = getNonFoldedSeatIndexes(state);
  if (contestantSeats.length <= 1) return true;

  const contenders = contestantSeats
    .map((seat) => getPlayerAtSeat(state, seat))
    .filter((p): p is PlayerRuntimeState => p != null);

  if (contenders.every((p) => p.isAllIn)) return true;

  return !anyNeedsToAct(state);
}

/**
 * Clears action when betting closes, otherwise rotates clockwise from the actor
 * (`table.activeSeatIndex`, still pointing at the seat that just acted).
 */

export function advanceTurnAfterAction(state: CoreGameState): CoreGameState {
  if (state.hand == null) return state;

  if (isBettingRoundComplete(state)) {
    return Object.freeze({
      ...state,
      table: Object.freeze({
        ...state.table,
        activeSeatIndex: null,
      }),
    });
  }

  const actor = state.table.activeSeatIndex;
  if (actor == null) return state;

  const max = state.table.maxSeats;
  for (let step = 1; step <= max; step++) {
    const seat = (actor + step) % max;
    if (needsToAct(state, seat)) {
      return Object.freeze({
        ...state,
        table: Object.freeze({
          ...state.table,
          activeSeatIndex: seat,
        }),
      });
    }
  }

  return Object.freeze({
    ...state,
    table: Object.freeze({
      ...state.table,
      activeSeatIndex: null,
    }),
  });
}
