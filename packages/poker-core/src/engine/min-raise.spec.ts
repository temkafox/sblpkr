import { describe, expect, it } from 'vitest';

import type { HandState } from '../domain/hand-state';

import {
  applyAggressiveBetMetadata,
  CoreGameState,
  createInitialGameState,
  getMaximumRaiseTarget,
  getMinimumRaiseTarget,
  getRaiseSize,
  isFullRaise,
} from '../index';

const EMPTY_POT = Object.freeze({
  total: 0,
  sidePots: Object.freeze([]),
});

function mkHand(
  o: Partial<HandState> &
    Pick<HandState, 'currentBet' | 'minRaise' | 'actedSeatIndexes'>,
): HandState {
  return Object.freeze({
    handId: o.handId ?? 'unit-hand',
    street: o.street ?? 'PRE-FLOP',
    deck: o.deck ?? Object.freeze([]),
    boardCards: o.boardCards ?? Object.freeze([]),
    pots: o.pots ?? EMPTY_POT,
    currentBet: o.currentBet,
    minRaise: o.minRaise,
    lastRaiseAmount: o.lastRaiseAmount ?? o.minRaise,
    lastAggressorSeatIndex: o.lastAggressorSeatIndex ?? null,
    actedSeatIndexes: o.actedSeatIndexes,
    raiseFrozenSeatIndexes: o.raiseFrozenSeatIndexes ?? Object.freeze([]),
    showdownReady: o.showdownReady ?? false,
    isComplete: o.isComplete ?? false,
  });
}

function attachHand(hand: HandState): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'minraise-test',
      maxSeats: 6,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [{ playerId: 'solo', seatIndex: 2, startingChips: 500 }],
  });

  return Object.freeze({ ...base, hand });
}

describe('getRaiseSize / isFullRaise', () => {
  it('computes increment between ceilings', () => {
    expect(getRaiseSize(10, 25)).toBe(15);
    expect(getRaiseSize(30, 38)).toBe(8);
  });

  it('classifies full vs incomplete raises against table minRaise', () => {
    expect(isFullRaise(10, 25, 10)).toBe(true);
    expect(isFullRaise(30, 38, 20)).toBe(false);
    expect(isFullRaise(30, 50, 20)).toBe(true);
  });
});

describe('getMinimumRaiseTarget / getMaximumRaiseTarget', () => {
  it('reflects live ceiling plus last full increment', () => {
    const g = attachHand(
      mkHand({
        currentBet: 40,
        minRaise: 15,
        actedSeatIndexes: Object.freeze([]),
      }),
    );

    expect(getMinimumRaiseTarget(g)).toBe(55);
    expect(getMaximumRaiseTarget(g, 2)).toBe(g.playersById.solo!.currentBet + 500);
  });
});

describe('applyAggressiveBetMetadata', () => {
  it('treats a legal-sized bump as a full reopening raise', () => {
    const hand = mkHand({
      currentBet: 10,
      minRaise: 10,
      actedSeatIndexes: Object.freeze([]),
      lastRaiseAmount: 10,
    });

    const next = applyAggressiveBetMetadata(attachHand(hand), 4, 10, 30);

    expect(next.hand?.currentBet).toBe(30);
    expect(next.hand?.minRaise).toBe(20);
    expect(next.hand?.lastRaiseAmount).toBe(20);
    expect(next.hand?.lastAggressorSeatIndex).toBe(4);
    expect(next.hand?.actedSeatIndexes).toEqual([4]);
    expect(next.hand?.raiseFrozenSeatIndexes).toEqual([]);
  });

  it('keeps minRaiseHistory after an incomplete aggressive stub', () => {
    const hand = mkHand({
      currentBet: 30,
      minRaise: 20,
      actedSeatIndexes: Object.freeze([1, 3]),
      lastRaiseAmount: 20,
      lastAggressorSeatIndex: 1,
    });

    const next = applyAggressiveBetMetadata(attachHand(hand), 5, 30, 38);

    expect(next.hand?.currentBet).toBe(38);
    expect(next.hand?.minRaise).toBe(20);
    expect(next.hand?.lastRaiseAmount).toBe(20);
    expect(next.hand?.lastAggressorSeatIndex).toBeNull();
    expect(next.hand?.raiseFrozenSeatIndexes.slice().sort((a, b) => a - b)).toEqual([
      1, 3,
    ]);
    expect(next.hand?.actedSeatIndexes.includes(5)).toBe(true);
  });

  it('accumulates freeze markers across chained incompletes', () => {
    const hand = mkHand({
      currentBet: 30,
      minRaise: 20,
      actedSeatIndexes: Object.freeze([1]),
      lastRaiseAmount: 20,
    });

    let state = attachHand(hand);
    state = applyAggressiveBetMetadata(state, 5, 30, 36);
    expect(state.hand?.raiseFrozenSeatIndexes).toEqual([1]);

    state = applyAggressiveBetMetadata(state, 3, 36, 40);
    expect(
      state.hand?.raiseFrozenSeatIndexes.slice().sort((a, b) => a - b),
    ).toEqual([1, 5]);
  });
});
