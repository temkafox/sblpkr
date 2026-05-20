import type { CoreGameState } from '../domain/game-state';
import type { SeatIndex } from '../domain/seat';

import {
  appendActedSeat,
  resetActedAfterAggression,
} from './betting-round';
import { InvalidTableStateError } from './errors';
import { getPlayerAtSeat } from './seat-utils';

export function getRaiseSize(previousCurrentBet: number, newBet: number): number {
  return newBet - previousCurrentBet;
}

export function isFullRaise(
  previousCurrentBet: number,
  newBet: number,
  minRaise: number,
): boolean {
  return getRaiseSize(previousCurrentBet, newBet) >= minRaise;
}

export function unionSeatIndexes(
  a: readonly SeatIndex[],
  b: readonly SeatIndex[],
): readonly SeatIndex[] {
  const set = new Set<SeatIndex>();
  for (const x of a) set.add(x);
  for (const x of b) set.add(x);
  return Object.freeze([...set].sort((x, y) => x - y));
}

/** Lowest legal raise‑to total on this street (full raises only — short all‑ins use `allin`). */

export function getMinimumRaiseTarget(state: CoreGameState): number {
  const hand = state.hand;
  if (hand == null || hand.isComplete) return 0;
  return hand.currentBet + hand.minRaise;
}

export function getMaximumRaiseTarget(
  state: CoreGameState,
  seatIndex: SeatIndex,
): number {
  const p = getPlayerAtSeat(state, seatIndex);
  if (p == null) return 0;
  return p.currentBet + p.chips;
}

/**
 * Applies hand-level consequences of an aggressive bet (raise / raising all‑in).
 * `state` must already include the aggressor's updated chips/currentBet/totalCommitted.
 */

export function applyAggressiveBetMetadata(
  state: CoreGameState,
  seatIndex: SeatIndex,
  previousCurrentBet: number,
  newBet: number,
): CoreGameState {
  const hand = state.hand;
  if (hand == null || hand.isComplete) {
    throw new InvalidTableStateError('No active hand');
  }

  if (newBet <= previousCurrentBet) {
    throw new InvalidTableStateError('Aggressive bet must increase currentBet');
  }

  const increment = getRaiseSize(previousCurrentBet, newBet);
  const full = isFullRaise(previousCurrentBet, newBet, hand.minRaise);

  if (full) {
    return Object.freeze({
      ...state,
      hand: Object.freeze({
        ...hand,
        currentBet: newBet,
        actedSeatIndexes: resetActedAfterAggression(seatIndex),
        raiseFrozenSeatIndexes: Object.freeze([]),
        minRaise: increment,
        lastRaiseAmount: increment,
        lastAggressorSeatIndex: seatIndex,
      }),
    });
  }

  const priorActed = hand.actedSeatIndexes;
  const nextFrozen = unionSeatIndexes(hand.raiseFrozenSeatIndexes, priorActed);

  return Object.freeze({
    ...state,
    hand: Object.freeze({
      ...hand,
      currentBet: newBet,
      actedSeatIndexes: appendActedSeat(hand, seatIndex),
      raiseFrozenSeatIndexes: nextFrozen,
      lastAggressorSeatIndex: null,
    }),
  });
}
