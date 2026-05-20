import type { SeatIndex } from './player';

/** Per-seat chip slice used for uncalled refunds metadata (Phase 4D1+). */

export type SeatChipSlice = {
  readonly seatIndex: SeatIndex;
  readonly amount: number;
};

/** One side pot slice after all-in branching (amounts only — rules live in poker-core). */

export type SidePot = {
  readonly amount: number;
  readonly eligibleSeatIndexes: readonly SeatIndex[];
};

/** Aggregate pot view for UI / wire snapshots. */

export type Pot = {
  readonly total: number;
  readonly sidePots: readonly SidePot[];
  /**
   * Amounts that must be returned as uncalled portions — **not** included in contested `sidePots`
   * sums (Phase 4D1 poker-core).
   */
  readonly returnableUncalled?: readonly SeatChipSlice[];
  /**
   * Audit-only: chips from tiers where every contributor folded, merged into the last contested side pot.
   */
  readonly deadMoneyMergedIntoLastContestedPot?: number;
};
