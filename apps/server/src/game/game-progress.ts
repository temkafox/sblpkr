import type { CoreGameState } from '@neonpoker/poker-core';
import {
  advanceStreet,
  canAdvanceStreet,
  isBettingRoundComplete,
  resolveShowdown,
} from '@neonpoker/poker-core';

/**
 * Auto-advances streets / terminal resolution after an action.
 * All poker rules live in poker-core — this only sequences public APIs.
 */

export function progressGameState(state: CoreGameState): CoreGameState {
  let g = state;
  let guard = 0;

  while (g.hand != null && !g.hand.isComplete && guard++ < 40) {
    if (g.hand.showdownReady) {
      return resolveShowdown(g);
    }

    if (isBettingRoundComplete(g) && canAdvanceStreet(g)) {
      g = advanceStreet(g);
      continue;
    }

    break;
  }

  if (
    g.hand != null &&
    g.hand.isComplete &&
    !g.hand.showdownReady
  ) {
    return resolveShowdown(g);
  }

  if (g.hand?.showdownReady && !g.hand.isComplete) {
    return resolveShowdown(g);
  }

  return g;
}
