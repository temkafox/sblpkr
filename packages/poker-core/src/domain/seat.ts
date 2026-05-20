import type { PlayerId, SeatIndex } from '@neonpoker/shared';

export type { PlayerId, SeatIndex } from '@neonpoker/shared';

/** Physical seat ring slot — occupancy only; blind/button math arrives in Phase 4. */

export type Seat = {
  readonly seatIndex: SeatIndex;
  readonly playerId: PlayerId | null;
};
