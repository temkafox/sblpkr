/** Chip texture key for `/assets/${chip}.png` — ported from /design/app.jsx */

export type ChipTexture =
  | 'pink-chip'
  | 'purple-chip'
  | 'green-chip'
  | 'blue-chip'
  | 'bw-chip';

export function chipFor(amount: number): ChipTexture {
  if (amount >= 100) return 'pink-chip';
  if (amount >= 25) return 'purple-chip';
  if (amount >= 10) return 'green-chip';
  if (amount >= 5) return 'blue-chip';
  return 'bw-chip';
}
