import type { CoreGameState } from '../domain/game-state';
import type { SeatIndex } from '../domain/seat';

/** Seats dealt into the current hand (canonical order, ascending seat index). */
export function getHandParticipantSeatIndexes(
  state: CoreGameState,
): readonly SeatIndex[] {
  const hand = state.hand;
  if (hand == null) {
    return Object.freeze([]);
  }
  return hand.participantSeatIndexes;
}

export function isHandParticipant(
  state: CoreGameState,
  seat: SeatIndex,
): boolean {
  return getHandParticipantSeatIndexes(state).includes(seat);
}
