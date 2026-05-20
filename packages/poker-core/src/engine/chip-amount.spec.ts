import { describe, expect, it } from 'vitest';

import {
  isIntegerChipAmount,
  requireIntegerChipAmount,
} from './chip-amount';
import { InvalidActionError } from './errors';

describe('chip-amount', () => {
  it('isIntegerChipAmount accepts whole non-negative values', () => {
    expect(isIntegerChipAmount(0)).toBe(true);
    expect(isIntegerChipAmount(76)).toBe(true);
  });

  it('isIntegerChipAmount rejects fractional values', () => {
    expect(isIntegerChipAmount(76.26)).toBe(false);
    expect(isIntegerChipAmount(-1)).toBe(false);
  });

  it('requireIntegerChipAmount throws for fractional values', () => {
    expect(() => requireIntegerChipAmount(10.5, 'Raise amount')).toThrow(
      InvalidActionError,
    );
  });
});
