import type { SeatIndex } from './player';

/** One side pot slice after all-in branching (amounts only — rules live in poker-core). */

export type SidePot = {
  readonly amount: number;
  readonly eligibleSeatIndexes: readonly SeatIndex[];
};

/** Aggregate pot view for UI / wire snapshots. */

export type Pot = {
  readonly total: number;
  readonly sidePots: readonly SidePot[];
};
