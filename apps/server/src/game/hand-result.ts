import type { CoreGameState } from '@neonpoker/poker-core';
import { getPlayerAtSeat } from '@neonpoker/poker-core';
import type { HandResultPayload } from '@neonpoker/shared';

/** Safe post-hand summary — seat indexes only, no hole cards or deck. */

export function extractHandResult(state: CoreGameState): HandResultPayload | null {
  const hand = state.hand;
  if (hand == null || !hand.isComplete) {
    return null;
  }

  const winners: number[] = [];
  for (const seat of state.table.seats) {
    const p = getPlayerAtSeat(state, seat.seatIndex);
    if (p != null && !p.hasFolded && !p.isSittingOut) {
      winners.push(seat.seatIndex);
    }
  }

  return {
    handId: hand.handId,
    winnerSeatIndexes: winners,
  };
}
