import { describe, expect, it } from 'vitest';

import type { Card } from '@neonpoker/shared';

import {
  compareEvaluatedHands,
  compareHands,
  evaluateBestHand,
  HandCategory,
} from './hand-evaluator';
import { DuplicateCardError, InvalidHandError } from './errors';

const c = (r: Card['r'], s: Card['s']): Card =>
  Object.freeze({ r, s });

describe('evaluateBestHand — category detection', () => {
  it('royal flush', () => {
    const h = evaluateBestHand([
      c('A', 's'),
      c('K', 's'),
      c('Q', 's'),
      c('J', 's'),
      c('10', 's'),
      c('2', 'c'),
      c('3', 'd'),
    ]);
    expect(h.category).toBe(HandCategory.RoyalFlush);
    expect(h.categoryRank).toBe(HandCategory.RoyalFlush);
    expect(h.tiebreakers).toEqual([14]);
  });

  it('straight flush (non-royal)', () => {
    const h = evaluateBestHand([
      c('9', 'h'),
      c('8', 'h'),
      c('7', 'h'),
      c('6', 'h'),
      c('5', 'h'),
      c('K', 'c'),
      c('A', 'd'),
    ]);
    expect(h.category).toBe(HandCategory.StraightFlush);
    expect(h.tiebreakers).toEqual([9]);
  });

  it('four of a kind + kicker', () => {
    const h = evaluateBestHand([
      c('7', 's'),
      c('7', 'h'),
      c('7', 'd'),
      c('7', 'c'),
      c('K', 's'),
      c('2', 'd'),
      c('3', 'c'),
    ]);
    expect(h.category).toBe(HandCategory.FourOfAKind);
    expect(h.tiebreakers).toEqual([7, 13]);
  });

  it('full house — trips on board plus pair in hand', () => {
    const h = evaluateBestHand([
      c('K', 'c'),
      c('K', 'd'),
      c('K', 'h'),
      c('2', 's'),
      c('3', 'c'),
      c('2', 'h'),
      c('2', 'd'),
    ]);
    expect(h.category).toBe(HandCategory.FullHouse);
    expect(h.tiebreakers).toEqual([13, 2]);
  });

  it('flush — pick top five suited when six spades', () => {
    const h = evaluateBestHand([
      c('A', 's'),
      c('Q', 's'),
      c('J', 's'),
      c('9', 's'),
      c('7', 's'),
      c('2', 's'),
      c('K', 'h'),
    ]);
    expect(h.category).toBe(HandCategory.Flush);
    expect(h.tiebreakers).toEqual([14, 12, 11, 9, 7]);
  });

  it('straight — choose higher of two possible', () => {
    const h = evaluateBestHand([
      c('9', 's'),
      c('8', 'h'),
      c('7', 'd'),
      c('6', 'c'),
      c('5', 's'),
      c('4', 'h'),
      c('K', 'c'),
    ]);
    expect(h.category).toBe(HandCategory.Straight);
    expect(h.tiebreakers).toEqual([9]);
  });

  it('wheel straight (5-high)', () => {
    const h = evaluateBestHand([
      c('A', 's'),
      c('2', 'h'),
      c('3', 'd'),
      c('4', 'c'),
      c('5', 's'),
      c('K', 'h'),
      c('Q', 'd'),
    ]);
    expect(h.category).toBe(HandCategory.Straight);
    expect(h.tiebreakers).toEqual([5]);
  });

  it('three of a kind + two kickers', () => {
    const h = evaluateBestHand([
      c('J', 's'),
      c('J', 'h'),
      c('J', 'c'),
      c('9', 'd'),
      c('5', 's'),
      c('2', 'c'),
      c('3', 'h'),
    ]);
    expect(h.category).toBe(HandCategory.ThreeOfAKind);
    expect(h.tiebreakers).toEqual([11, 9, 5]);
  });

  it('two pair + kicker', () => {
    const h = evaluateBestHand([
      c('K', 's'),
      c('K', 'c'),
      c('5', 'h'),
      c('5', 'd'),
      c('9', 's'),
      c('2', 'c'),
      c('3', 'h'),
    ]);
    expect(h.category).toBe(HandCategory.TwoPair);
    expect(h.tiebreakers).toEqual([13, 5, 9]);
  });

  it('one pair + kickers', () => {
    const h = evaluateBestHand([
      c('A', 's'),
      c('A', 'h'),
      c('Q', 'd'),
      c('9', 'c'),
      c('5', 's'),
      c('2', 'h'),
      c('3', 'c'),
    ]);
    expect(h.category).toBe(HandCategory.OnePair);
    expect(h.tiebreakers).toEqual([14, 12, 9, 5]);
  });

  it('high card', () => {
    const h = evaluateBestHand([
      c('A', 's'),
      c('Q', 'h'),
      c('9', 'd'),
      c('7', 'c'),
      c('5', 's'),
      c('2', 'h'),
      c('3', 'c'),
    ]);
    expect(h.category).toBe(HandCategory.HighCard);
    expect(h.tiebreakers).toEqual([14, 12, 9, 7, 5]);
  });
});

describe('compareEvaluatedHands — category ordering', () => {
  const sf = evaluateBestHand([
    c('9', 's'),
    c('8', 's'),
    c('7', 's'),
    c('6', 's'),
    c('5', 's'),
    c('2', 'c'),
    c('3', 'd'),
  ]);
  const quads = evaluateBestHand([
    c('4', 's'),
    c('4', 'h'),
    c('4', 'd'),
    c('4', 'c'),
    c('A', 's'),
    c('K', 'h'),
    c('Q', 'd'),
  ]);
  const boat = evaluateBestHand([
    c('Q', 's'),
    c('Q', 'h'),
    c('Q', 'd'),
    c('7', 'c'),
    c('7', 's'),
    c('2', 'h'),
    c('3', 'd'),
  ]);
  const flush = evaluateBestHand([
    c('A', 'h'),
    c('J', 'h'),
    c('9', 'h'),
    c('7', 'h'),
    c('5', 'h'),
    c('K', 's'),
    c('Q', 'd'),
  ]);
  const straight = evaluateBestHand([
    c('9', 's'),
    c('8', 'h'),
    c('7', 'd'),
    c('6', 'c'),
    c('5', 's'),
    c('K', 'h'),
    c('A', 'd'),
  ]);
  const trips = evaluateBestHand([
    c('10', 's'),
    c('10', 'h'),
    c('10', 'd'),
    c('K', 'c'),
    c('9', 's'),
    c('2', 'h'),
    c('3', 'd'),
  ]);
  const twoPair = evaluateBestHand([
    c('8', 's'),
    c('8', 'h'),
    c('3', 'd'),
    c('3', 'c'),
    c('A', 's'),
    c('K', 'h'),
    c('Q', 'd'),
  ]);
  const pair = evaluateBestHand([
    c('6', 's'),
    c('6', 'h'),
    c('A', 'd'),
    c('K', 'c'),
    c('Q', 's'),
    c('2', 'h'),
    c('3', 'd'),
  ]);
  const high = evaluateBestHand([
    c('A', 's'),
    c('Q', 'h'),
    c('9', 'd'),
    c('7', 'c'),
    c('5', 's'),
    c('2', 'h'),
    c('3', 'd'),
  ]);

  it('straight flush beats quads', () => {
    expect(compareEvaluatedHands(sf, quads)).toBeGreaterThan(0);
  });
  it('quads beats full house', () => {
    expect(compareEvaluatedHands(quads, boat)).toBeGreaterThan(0);
  });
  it('full house beats flush', () => {
    expect(compareEvaluatedHands(boat, flush)).toBeGreaterThan(0);
  });
  it('flush beats straight', () => {
    expect(compareEvaluatedHands(flush, straight)).toBeGreaterThan(0);
  });
  it('straight beats trips', () => {
    expect(compareEvaluatedHands(straight, trips)).toBeGreaterThan(0);
  });
  it('trips beats two pair', () => {
    expect(compareEvaluatedHands(trips, twoPair)).toBeGreaterThan(0);
  });
  it('two pair beats pair', () => {
    expect(compareEvaluatedHands(twoPair, pair)).toBeGreaterThan(0);
  });
  it('pair beats high card', () => {
    expect(compareEvaluatedHands(pair, high)).toBeGreaterThan(0);
  });
});

describe('compareEvaluatedHands — tie-breakers', () => {
  it('pair with better kicker wins', () => {
    const a = evaluateBestHand([
      c('8', 's'),
      c('8', 'h'),
      c('A', 'd'),
      c('K', 'c'),
      c('7', 's'),
    ]);
    const b = evaluateBestHand([
      c('8', 's'),
      c('8', 'h'),
      c('Q', 'd'),
      c('J', 'c'),
      c('9', 's'),
    ]);
    expect(compareEvaluatedHands(a, b)).toBeGreaterThan(0);
  });

  it('two pair — higher top pair wins', () => {
    const a = evaluateBestHand([
      c('K', 's'),
      c('K', 'h'),
      c('4', 'd'),
      c('4', 'c'),
      c('9', 's'),
    ]);
    const b = evaluateBestHand([
      c('Q', 's'),
      c('Q', 'h'),
      c('J', 'd'),
      c('J', 'c'),
      c('A', 's'),
    ]);
    expect(compareEvaluatedHands(a, b)).toBeGreaterThan(0);
  });

  it('two pair — same pairs, better kicker wins', () => {
    const a = evaluateBestHand([
      c('K', 's'),
      c('K', 'h'),
      c('5', 'd'),
      c('5', 'c'),
      c('A', 's'),
    ]);
    const b = evaluateBestHand([
      c('K', 's'),
      c('K', 'h'),
      c('5', 'd'),
      c('5', 'c'),
      c('Q', 's'),
    ]);
    expect(compareEvaluatedHands(a, b)).toBeGreaterThan(0);
  });

  it('trips with better kicker wins', () => {
    const a = evaluateBestHand([
      c('9', 's'),
      c('9', 'h'),
      c('9', 'd'),
      c('A', 'c'),
      c('5', 's'),
    ]);
    const b = evaluateBestHand([
      c('9', 's'),
      c('9', 'h'),
      c('9', 'd'),
      c('K', 'c'),
      c('Q', 's'),
    ]);
    expect(compareEvaluatedHands(a, b)).toBeGreaterThan(0);
  });

  it('flush — higher top rank wins', () => {
    const a = evaluateBestHand([
      c('A', 's'),
      c('J', 's'),
      c('9', 's'),
      c('7', 's'),
      c('5', 's'),
    ]);
    const b = evaluateBestHand([
      c('K', 's'),
      c('Q', 's'),
      c('J', 's'),
      c('9', 's'),
      c('7', 's'),
    ]);
    expect(compareEvaluatedHands(a, b)).toBeGreaterThan(0);
  });

  it('straight — 6-high beats wheel 5-high', () => {
    const wheel = evaluateBestHand([
      c('A', 's'),
      c('2', 'h'),
      c('3', 'd'),
      c('4', 'c'),
      c('5', 's'),
    ]);
    const sixHigh = evaluateBestHand([
      c('6', 's'),
      c('5', 'h'),
      c('4', 'd'),
      c('3', 'c'),
      c('2', 's'),
    ]);
    expect(compareEvaluatedHands(sixHigh, wheel)).toBeGreaterThan(0);
  });

  it('full house AAA22 beats KKKAA', () => {
    const aaa22 = evaluateBestHand([
      c('A', 's'),
      c('A', 'h'),
      c('A', 'd'),
      c('2', 'c'),
      c('2', 's'),
    ]);
    const kkkaa = evaluateBestHand([
      c('K', 's'),
      c('K', 'h'),
      c('K', 'd'),
      c('A', 'c'),
      c('A', 's'),
    ]);
    expect(compareEvaluatedHands(aaa22, kkkaa)).toBeGreaterThan(0);
  });

  it('quads with better kicker wins', () => {
    const a = evaluateBestHand([
      c('3', 's'),
      c('3', 'h'),
      c('3', 'd'),
      c('3', 'c'),
      c('A', 's'),
    ]);
    const b = evaluateBestHand([
      c('3', 's'),
      c('3', 'h'),
      c('3', 'd'),
      c('3', 'c'),
      c('K', 's'),
    ]);
    expect(compareEvaluatedHands(a, b)).toBeGreaterThan(0);
  });

  it('equal hands compare as tie', () => {
    const cards = [
      c('10', 's'),
      c('10', 'h'),
      c('9', 'd'),
      c('8', 'c'),
      c('7', 's'),
      c('2', 'h'),
      c('3', 'd'),
    ];
    expect(compareEvaluatedHands(evaluateBestHand(cards), evaluateBestHand(cards))).toBe(
      0,
    );
  });
});

describe('compareHands helper', () => {
  it('delegates to evaluate + compareEvaluatedHands', () => {
    const a = [
      c('A', 's'),
      c('K', 's'),
      c('Q', 's'),
      c('J', 's'),
      c('10', 's'),
    ];
    const b = [
      c('K', 'h'),
      c('Q', 'h'),
      c('J', 'h'),
      c('10', 'h'),
      c('9', 'h'),
    ];
    expect(
      compareHands(a, b),
    ).toBe(compareEvaluatedHands(evaluateBestHand(a), evaluateBestHand(b)));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
});

describe('validation', () => {
  it('duplicate cards throw DuplicateCardError', () => {
    expect(() =>
      evaluateBestHand([
        c('A', 's'),
        c('A', 's'),
        c('K', 'h'),
        c('Q', 'd'),
        c('J', 'c'),
      ]),
    ).toThrow(DuplicateCardError);
  });

  it('fewer than 5 cards throws InvalidHandError', () => {
    expect(() =>
      evaluateBestHand([c('A', 's'), c('K', 'h'), c('Q', 'd'), c('J', 'c')]),
    ).toThrow(InvalidHandError);
  });

  it('more than 7 cards throws InvalidHandError', () => {
    expect(() =>
      evaluateBestHand([
        c('A', 's'),
        c('K', 's'),
        c('Q', 's'),
        c('J', 's'),
        c('10', 's'),
        c('9', 's'),
        c('8', 's'),
        c('7', 's'),
      ]),
    ).toThrow(InvalidHandError);
  });

  it('input array and card objects are not mutated', () => {
    const cards: Card[] = [
      Object.freeze({ r: '7', s: 'h' }),
      Object.freeze({ r: '8', s: 'd' }),
      Object.freeze({ r: '9', s: 'c' }),
      Object.freeze({ r: '10', s: 's' }),
      Object.freeze({ r: 'J', s: 'h' }),
    ];
    const snap = cards.map((x) => ({ r: x.r, s: x.s }));
    evaluateBestHand(cards);
    expect(cards.map((x) => ({ r: x.r, s: x.s }))).toEqual(snap);
  });
});

describe('rank normalization', () => {
  it('maps T alias to 10 so hole cards count in seven-card evaluation', () => {
    const board = [
      c('A', 's'),
      c('4', 'c'),
      c('4', 's'),
      c('J', 'c'),
      c('3', 'd'),
    ];
    const withAlias = evaluateBestHand([
      c('A', 'c'),
      Object.freeze({ r: 'T' as Card['r'], s: 's' }),
      ...board,
    ]);
    const canonical = evaluateBestHand([c('A', 'c'), c('10', 's'), ...board]);
    expect(withAlias.category).toBe(HandCategory.TwoPair);
    expect(compareEvaluatedHands(withAlias, canonical)).toBe(0);
  });

  it('reported split-pot hand: c32c beats ASD when tens are included', () => {
    const board = [
      c('A', 's'),
      c('4', 'c'),
      c('4', 's'),
      c('J', 'c'),
      c('3', 'd'),
    ];
    const asd = evaluateBestHand([c('9', 'c'), c('6', 'd'), ...board]);
    const c32c = evaluateBestHand([c('A', 'c'), c('10', 's'), ...board]);
    expect(compareEvaluatedHands(c32c, asd)).toBeGreaterThan(0);
  });
});

describe('wheel edge — duplicate rank does not break straight when choosing 5', () => {
  it('still finds straight among 7 with a pair', () => {
    const h = evaluateBestHand([
      c('6', 's'),
      c('5', 'h'),
      c('4', 'd'),
      c('3', 'c'),
      c('2', 's'),
      c('6', 'c'),
      c('A', 'h'),
    ]);
    expect(h.category).toBe(HandCategory.Straight);
    expect(h.tiebreakers).toEqual([6]);
  });
});
