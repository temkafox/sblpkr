import type { HandState } from '../domain/hand-state';
import type { PublicSeatAction } from '@neonpoker/shared';
import type { SeatIndex } from '../domain/seat';

export function recordPublicSeatAction(
  hand: HandState,
  seatIndex: SeatIndex,
  action: PublicSeatAction,
): HandState {
  return Object.freeze({
    ...hand,
    lastPublicActionsBySeat: Object.freeze({
      ...hand.lastPublicActionsBySeat,
      [seatIndex]: Object.freeze({ ...action }),
    }),
  });
}
