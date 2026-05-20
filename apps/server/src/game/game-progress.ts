import type { CoreGameState, ShowdownResult } from '@neonpoker/poker-core';
import {
  advanceStreet,
  canAdvanceStreet,
  computeShowdownResult,
  getNonFoldedSeatIndexes,
  isBettingRoundComplete,
  resolveShowdown,
} from '@neonpoker/poker-core';

import type { MutableInternalRoom } from '../room/room.types';
import { logShowdownResolution } from './showdown-debug';

export type ProgressGameStateResult = {
  readonly state: CoreGameState;
  readonly showdownResult: ShowdownResult | null;
  readonly isFoldWin: boolean;
};

function resolveWithTracking(
  state: CoreGameState,
  room: MutableInternalRoom | null = null,
): ProgressGameStateResult {
  const isFoldWin = getNonFoldedSeatIndexes(state).length === 1;
  const showdownResult = computeShowdownResult(state);

  if (!isFoldWin) {
    logShowdownResolution(state, showdownResult, room);
  }

  return {
    state: resolveShowdown(state),
    showdownResult,
    isFoldWin,
  };
}

/**
 * Auto-advances streets / terminal resolution after an action.
 * All poker rules live in poker-core — this only sequences public APIs.
 */

export function progressGameState(
  state: CoreGameState,
  room: MutableInternalRoom | null = null,
): ProgressGameStateResult {
  let g = state;
  let guard = 0;

  while (g.hand != null && !g.hand.isComplete && guard++ < 40) {
    if (g.hand.showdownReady) {
      return resolveWithTracking(g, room);
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
    return resolveWithTracking(g, room);
  }

  if (g.hand?.showdownReady && !g.hand.isComplete) {
    return resolveWithTracking(g, room);
  }

  return { state: g, showdownResult: null, isFoldWin: false };
}
