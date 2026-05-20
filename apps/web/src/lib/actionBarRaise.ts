/** UI-only raise amount helpers — clamp to server-provided min/max, no poker rules. */

import { normalizeChipAmount } from './formatChips';

export function clampRaiseAmount(
  amount: number,
  min: number,
  max: number,
): number {
  const minInt = normalizeChipAmount(min);
  const maxInt = normalizeChipAmount(max);
  if (maxInt < minInt) return minInt;
  return Math.min(maxInt, Math.max(minInt, normalizeChipAmount(amount)));
}

export function sliderPctFromRaiseAmount(
  amount: number,
  min: number,
  max: number,
): number {
  const minInt = normalizeChipAmount(min);
  const maxInt = normalizeChipAmount(max);
  const amountInt = normalizeChipAmount(amount);
  if (maxInt <= minInt) return 0;
  return ((amountInt - minInt) / (maxInt - minInt)) * 100;
}

export function raiseAmountFromSliderPct(
  pct: number,
  min: number,
  max: number,
): number {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const minInt = normalizeChipAmount(min);
  const maxInt = normalizeChipAmount(max);
  if (maxInt <= minInt) return minInt;
  const raw = minInt + ((maxInt - minInt) * clampedPct) / 100;
  return clampRaiseAmount(raw, minInt, maxInt);
}

export type QuickRaiseKind = 'min' | 'half' | 'pot' | '2x';

export function quickRaiseAmount(
  kind: QuickRaiseKind,
  min: number,
  max: number,
  potAmount: number,
): number {
  const minInt = normalizeChipAmount(min);
  const maxInt = normalizeChipAmount(max);
  const potInt = normalizeChipAmount(potAmount);
  let raw = minInt;
  switch (kind) {
    case 'min':
      raw = minInt;
      break;
    case 'half':
      raw = Math.round(potInt / 2);
      break;
    case 'pot':
      raw = potInt;
      break;
    case '2x':
      raw = potInt * 2;
      break;
  }
  return clampRaiseAmount(raw, minInt, maxInt);
}

export function isValidRaiseAmount(
  amount: number,
  min: number,
  max: number,
): boolean {
  const normalized = normalizeChipAmount(amount);
  return (
    normalized === amount &&
    Number.isFinite(amount) &&
    amount >= normalizeChipAmount(min) &&
    amount <= normalizeChipAmount(max)
  );
}
