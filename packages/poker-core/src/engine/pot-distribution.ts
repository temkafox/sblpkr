import type { SeatIndex } from '../domain/seat';

import { NoEligibleWinnersError, PotDistributionError } from './errors';

/** Per-pot chip grants keyed by seat (sparse record). */

export type AwardedAmountsBySeatIndex = Readonly<Partial<Record<SeatIndex, number>>>;

/**
 * First winning seat encountered moving clockwise from the seat immediately after the button.
 */

export function getOddChipWinner(
  winningSeatIndexes: readonly SeatIndex[],
  dealerSeatIndex: SeatIndex,
  maxSeats: number,
): SeatIndex {
  const win = new Set(winningSeatIndexes);
  if (win.size === 0) {
    throw new PotDistributionError('getOddChipWinner: empty winners');
  }
  for (let step = 1; step <= maxSeats; step++) {
    const seat = (dealerSeatIndex + step) % maxSeats;
    if (win.has(seat)) return seat;
  }
  throw new PotDistributionError('getOddChipWinner: no winner seat in ring');
}

/**
 * Winning seats ordered by first clockwise appearance starting `(dealer + 1) % maxSeats`.
 * Used to assign multiple odd chips deterministically (first `remainder` seats each get +1).
 */

export function orderWinnersClockwiseFromDealer(
  winningSeatIndexes: readonly SeatIndex[],
  dealerSeatIndex: SeatIndex,
  maxSeats: number,
): readonly SeatIndex[] {
  const win = new Set(winningSeatIndexes);
  const ordered: SeatIndex[] = [];
  for (let step = 1; step <= maxSeats; step++) {
    const seat = (dealerSeatIndex + step) % maxSeats;
    if (win.has(seat)) ordered.push(seat);
  }
  return Object.freeze(ordered);
}

/**
 * Split `amount` evenly among winners; remainder chips go one each to the first seats in
 * clockwise order from the button (odd-chip rule, extended when remainder > 1).
 */

export function splitPotWithOddChipRule(
  amount: number,
  winningSeatIndexes: readonly SeatIndex[],
  dealerSeatIndex: SeatIndex,
  maxSeats: number,
): AwardedAmountsBySeatIndex {
  const uniq = [...new Set(winningSeatIndexes)].sort((a, b) => a - b);
  if (uniq.length === 0) {
    throw new NoEligibleWinnersError('splitPotWithOddChipRule: no winners');
  }
  const ordered = orderWinnersClockwiseFromDealer(uniq, dealerSeatIndex, maxSeats);
  const k = ordered.length;
  const base = Math.floor(amount / k);
  const rem = amount % k;
  const acc: Partial<Record<SeatIndex, number>> = Object.create(null);
  for (const s of ordered) {
    acc[s] = base;
  }
  for (let i = 0; i < rem; i++) {
    const s = ordered[i]!;
    acc[s] = (acc[s] ?? 0) + 1;
  }
  return Object.freeze(acc);
}
