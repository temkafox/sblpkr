import { describe, expect, it } from 'vitest';

import { formatChips, normalizeChipAmount } from './formatChips';

describe('formatChips', () => {
  it('normalizes fractional values to integers', () => {
    expect(normalizeChipAmount(76.26)).toBe(76);
    expect(normalizeChipAmount(238.87)).toBe(239);
  });

  it('formats chip amounts without decimals', () => {
    expect(formatChips(76.26)).toBe('76');
    expect(formatChips(200)).toBe('200');
  });
});
