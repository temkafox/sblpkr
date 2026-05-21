import type { CoreGameState } from '../domain/game-state';
import type { SeatIndex } from '../domain/seat';

import { isHandParticipant } from './hand-participants';
import { getMaximumRaiseTarget, getMinimumRaiseTarget } from './min-raise';
import { getPlayerAtSeat } from './seat-utils';

/** Mirrors `@neonpoker/shared` `AvailableActions` — totals are raise‑to amounts on this street. */

export type CoreAvailableActions = {
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly canCall: boolean;
  readonly callAmount: number;
  readonly canRaise: boolean;
  readonly minRaise: number;
  readonly maxRaise: number;
  readonly canAllIn: boolean;
};

const DISABLED: CoreAvailableActions = Object.freeze({
  canFold: false,
  canCheck: false,
  canCall: false,
  callAmount: 0,
  canRaise: false,
  minRaise: 0,
  maxRaise: 0,
  canAllIn: false,
});

export function getAvailableActions(
  state: CoreGameState,
  seatIndex: SeatIndex,
): CoreAvailableActions {
  const hand = state.hand;
  if (hand == null || hand.isComplete) return DISABLED;
  if (hand.showdownReady || hand.street === 'SHOWDOWN') return DISABLED;

  if (!isHandParticipant(state, seatIndex)) return DISABLED;

  const turn = state.table.activeSeatIndex;
  if (turn == null || turn !== seatIndex) return DISABLED;

  const p = getPlayerAtSeat(state, seatIndex);
  if (p == null || p.hasFolded || p.isSittingOut || p.isAllIn) {
    return DISABLED;
  }

  const facing = hand.currentBet - p.currentBet;
  const canCheck = facing <= 0;
  const callAmount = facing > 0 ? Math.min(facing, p.chips) : 0;
  const canCall = facing > 0 && p.chips > 0;

  const minTotal = getMinimumRaiseTarget(state);
  const maxTotal = getMaximumRaiseTarget(state, seatIndex);
  const raiseFrozen = hand.raiseFrozenSeatIndexes.includes(seatIndex);
  const canRaise =
    !raiseFrozen &&
    p.chips > 0 &&
    minTotal <= maxTotal &&
    minTotal > hand.currentBet;

  return Object.freeze({
    canFold: true,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaise: minTotal,
    maxRaise: maxTotal,
    canAllIn: p.chips > 0,
  });
}
