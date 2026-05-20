import { describe, expect, it } from 'vitest';

import {
  getOddChipWinner,
  orderWinnersClockwiseFromDealer,
  splitPotWithOddChipRule,
} from './pot-distribution';

describe('getOddChipWinner', () => {
  it('returns first winner clockwise from dealer (dealer 0)', () => {
    expect(getOddChipWinner([3, 7, 1], 0, 9)).toBe(1);
  });

  it('wraps the table', () => {
    expect(getOddChipWinner([0, 8], 7, 9)).toBe(8);
  });

  it('handles dealer among winners — still starts scan after button', () => {
    expect(getOddChipWinner([2, 5], 5, 9)).toBe(2);
  });
});

describe('orderWinnersClockwiseFromDealer', () => {
  it('orders winners by clockwise appearance from dealer+1', () => {
    expect(orderWinnersClockwiseFromDealer([7, 1, 3], 0, 9)).toEqual([
      1, 3, 7,
    ]);
  });
});

describe('splitPotWithOddChipRule', () => {
  it('splits evenly with no remainder', () => {
    expect(splitPotWithOddChipRule(100, [2, 5], 0, 9)).toEqual({
      2: 50,
      5: 50,
    });
  });

  it('assigns odd chip to earliest clockwise winner', () => {
    expect(splitPotWithOddChipRule(101, [3, 7, 1], 0, 9)).toEqual({
      1: 34,
      3: 34,
      7: 33,
    });
  });

  it('assigns multiple remainder chips along clockwise order', () => {
    expect(splitPotWithOddChipRule(104, [8, 2], 5, 9)).toEqual({
      8: 52,
      2: 52,
    });
    expect(splitPotWithOddChipRule(103, [8, 2], 5, 9)).toEqual({
      8: 52,
      2: 51,
    });
  });
});
