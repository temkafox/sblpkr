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
  readonly isComplete: boolean;
};
