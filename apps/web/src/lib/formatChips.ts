/** Normalize and format whole-chip amounts for MVP UI. */

export function normalizeChipAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

/** Display chip amounts as integers — no fractional cents. */
export function formatChips(amount: number): string {
  return String(normalizeChipAmount(amount));
}
