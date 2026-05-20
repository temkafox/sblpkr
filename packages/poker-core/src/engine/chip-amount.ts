import { InvalidActionError } from './errors';

/** Returns true when `amount` is a non-negative whole chip count. */
export function isIntegerChipAmount(amount: number): boolean {
  return Number.isFinite(amount) && Number.isInteger(amount) && amount >= 0;
}

/** Validates chip amounts before mutating game state. */
export function requireIntegerChipAmount(
  amount: number,
  label = 'Chip amount',
): number {
  if (!isIntegerChipAmount(amount)) {
    throw new InvalidActionError(`${label} must be a non-negative integer`);
  }
  return amount;
}
