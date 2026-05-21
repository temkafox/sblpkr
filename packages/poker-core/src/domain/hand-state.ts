import type { Pot, PublicSeatAction, Street } from '@neonpoker/shared';

import type { Card } from './card';
import type { SeatIndex } from './seat';

export type LastPublicActionsBySeat = Readonly<
  Partial<Record<SeatIndex, PublicSeatAction>>
>;

/** Engine‑local hand snapshot — fields mirror Phase 4 engine needs (values start neutral). */

export type HandState = {
  readonly handId: string;
  /** Server seats dealt into this hand — frozen at startHand; late joiners are excluded. */
  readonly participantSeatIndexes: readonly SeatIndex[];
  readonly street: Street;
  readonly deck: readonly Card[];
  readonly boardCards: readonly Card[];
  readonly pots: Pot;
  readonly currentBet: number;
  readonly minRaise: number;
  readonly lastRaiseAmount: number;
  readonly lastAggressorSeatIndex: SeatIndex | null;
  readonly actedSeatIndexes: readonly SeatIndex[];
  /** Latest public action per seat for wire seat labels (Phase 7H). */
  readonly lastPublicActionsBySeat: LastPublicActionsBySeat;
  /** Seats barred from raising after an incomplete all-in until the next full raise (Phase 4C). */
  readonly raiseFrozenSeatIndexes: readonly SeatIndex[];
  /** Board dealt through river — awaiting evaluator / Phase 4D (no betting). */
  readonly showdownReady: boolean;
  readonly isComplete: boolean;
};
