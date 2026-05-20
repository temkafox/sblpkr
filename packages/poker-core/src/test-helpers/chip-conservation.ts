import { expect } from 'vitest';

import type { CoreGameState } from '../domain/game-state';

/**
 * Sum of each player's liquid stack (`chips`) plus chips locked for this hand (`totalCommitted`).
 *
 * `currentBet` is **not** added separately—those chips already moved out of `chips` into
 * `totalCommitted` when posted or matched in this engine, so counting both would double-book.
 */

export function getTotalWealth(state: CoreGameState): number {
  let sum = 0;
  for (const pid of Object.keys(state.playersById)) {
    const p = state.playersById[pid]!;
    sum += p.chips + p.totalCommitted;
  }
  return sum;
}

export function assertChipConservation(
  before: CoreGameState,
  after: CoreGameState,
): void {
  expect(getTotalWealth(after)).toBe(getTotalWealth(before));
}
