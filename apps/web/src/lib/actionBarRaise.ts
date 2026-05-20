/** UI-only raise amount helpers — clamp to server-provided min/max, no poker rules. */

export function clampRaiseAmount(
  amount: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(amount)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, amount));
}

export function sliderPctFromRaiseAmount(
  amount: number,
  min: number,
  max: number,
): number {
  if (max <= min) return 0;
  return ((amount - min) / (max - min)) * 100;
}

export function raiseAmountFromSliderPct(
  pct: number,
  min: number,
  max: number,
): number {
  const clampedPct = Math.min(100, Math.max(0, pct));
  if (max <= min) return min;
  const raw = min + ((max - min) * clampedPct) / 100;
  return clampRaiseAmount(raw, min, max);
}

export type QuickRaiseKind = 'min' | 'half' | 'pot' | '2x';

export function quickRaiseAmount(
  kind: QuickRaiseKind,
  min: number,
  max: number,
  potAmount: number,
): number {
  let raw = min;
  switch (kind) {
    case 'min':
      raw = min;
      break;
    case 'half':
      raw = potAmount / 2;
      break;
    case 'pot':
      raw = potAmount;
      break;
    case '2x':
      raw = potAmount * 2;
      break;
  }
  return clampRaiseAmount(raw, min, max);
}

export function isValidRaiseAmount(
  amount: number,
  min: number,
  max: number,
): boolean {
  return Number.isFinite(amount) && amount >= min && amount <= max;
}
