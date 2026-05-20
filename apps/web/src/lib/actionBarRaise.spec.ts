import { describe, expect, it } from 'vitest';

import {
  clampRaiseAmount,
  isValidRaiseAmount,
  quickRaiseAmount,
  raiseAmountFromSliderPct,
  sliderPctFromRaiseAmount,
} from './actionBarRaise';

describe('actionBarRaise', () => {
  it('clampRaiseAmount clamps to integer min and max', () => {
    expect(clampRaiseAmount(5.7, 10, 100)).toBe(10);
    expect(clampRaiseAmount(150.2, 10, 100)).toBe(100);
    expect(clampRaiseAmount(50.4, 10, 100)).toBe(50);
  });

  it('sliderPctFromRaiseAmount and raiseAmountFromSliderPct produce integers', () => {
    expect(sliderPctFromRaiseAmount(55, 10, 110)).toBe(45);
    expect(raiseAmountFromSliderPct(45, 10, 110)).toBe(55);
    expect(Number.isInteger(raiseAmountFromSliderPct(33.3, 10, 110))).toBe(true);
  });

  it('quickRaiseAmount uses integer pot helpers clamped to min/max', () => {
    expect(quickRaiseAmount('min', 20, 200, 100)).toBe(20);
    expect(quickRaiseAmount('half', 20, 200, 101)).toBe(51);
    expect(quickRaiseAmount('pot', 20, 200, 100)).toBe(100);
    expect(quickRaiseAmount('2x', 20, 200, 100)).toBe(200);
    expect(quickRaiseAmount('pot', 20, 50, 100)).toBe(50);
  });

  it('isValidRaiseAmount requires integer amounts', () => {
    expect(isValidRaiseAmount(10, 10, 100)).toBe(true);
    expect(isValidRaiseAmount(10.5, 10, 100)).toBe(false);
  });
});
