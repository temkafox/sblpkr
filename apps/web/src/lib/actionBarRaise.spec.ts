import { describe, expect, it } from 'vitest';

import {
  clampRaiseAmount,
  isValidRaiseAmount,
  quickRaiseAmount,
  raiseAmountFromSliderPct,
  sliderPctFromRaiseAmount,
} from './actionBarRaise';

describe('actionBarRaise', () => {
  it('clampRaiseAmount clamps to min and max', () => {
    expect(clampRaiseAmount(5, 10, 100)).toBe(10);
    expect(clampRaiseAmount(150, 10, 100)).toBe(100);
    expect(clampRaiseAmount(50, 10, 100)).toBe(50);
  });

  it('sliderPctFromRaiseAmount and raiseAmountFromSliderPct are inverse', () => {
    expect(sliderPctFromRaiseAmount(55, 10, 110)).toBe(45);
    expect(raiseAmountFromSliderPct(45, 10, 110)).toBe(55);
  });

  it('quickRaiseAmount uses pot helpers clamped to min/max', () => {
    expect(quickRaiseAmount('min', 20, 200, 100)).toBe(20);
    expect(quickRaiseAmount('half', 20, 200, 100)).toBe(50);
    expect(quickRaiseAmount('pot', 20, 200, 100)).toBe(100);
    expect(quickRaiseAmount('2x', 20, 200, 100)).toBe(200);
    expect(quickRaiseAmount('pot', 20, 50, 100)).toBe(50);
  });

  it('isValidRaiseAmount checks inclusive bounds', () => {
    expect(isValidRaiseAmount(10, 10, 100)).toBe(true);
    expect(isValidRaiseAmount(100, 10, 100)).toBe(true);
    expect(isValidRaiseAmount(9, 10, 100)).toBe(false);
    expect(isValidRaiseAmount(101, 10, 100)).toBe(false);
  });
});
