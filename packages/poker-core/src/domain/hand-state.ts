import type { Pot, Street } from '@neonpoker/shared';

import type { Card } from './card';
import type { SeatIndex } from './seat';

/** Engine‑local hand snapshot — fields mirror Phase 4 engine needs (values start neutral). */

export type HandState = {
  readonly handId: string;
  readonly street: Street;
  readonly deck: readonly Card[];
  readonly boardCards: readonly Card[];
  readonly pots: Pot;
  readonly currentBet: number;
  readonly minRaise: number;
  readonly lastRaiseAmount: number;
  readonly lastAggressorSeatIndex: SeatIndex | null;
  readonly actedSeatIndexes: readonly SeatIndex[];
  /** Seats barred from raising after an incomplete all-in until the next full raise (Phase 4C). */
  readonly raiseFrozenSeatIndexes: readonly SeatIndex[];
  /** Board dealt through river — awaiting evaluator / Phase 4D (no betting). */
  readonly showdownReady: boolean;
  readonly isComplete: boolean;
};
