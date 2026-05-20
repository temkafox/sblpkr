import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { CorePlayerAction } from '../domain/player-action';
import type { SeatIndex } from '../domain/seat';

import {
  appendActedSeat,
  advanceTurnAfterAction,
  isBettingRoundComplete,
  mergeHandPotTotal,
  resetActedAfterAggression,
} from './betting-round';
import {
  CannotCallError,
  CannotCheckError,
  CannotRaiseError,
  InsufficientChipsError,
  InvalidActionError,
  InvalidTableStateError,
  OutOfTurnError,
} from './errors';
import { getPlayerAtSeat } from './seat-utils';

function clonePlayers(
  playersById: Readonly<Record<string, PlayerRuntimeState>>,
): Record<string, PlayerRuntimeState> {
  const out: Record<string, PlayerRuntimeState> = Object.create(null);
  for (const k of Object.keys(playersById)) {
    out[k] = playersById[k]!;
  }
  return out;
}

export function applyAction(
  state: CoreGameState,
  seatIndex: SeatIndex,
  action: CorePlayerAction,
): CoreGameState {
  const hand = state.hand;
  if (hand == null || hand.isComplete) {
    throw new InvalidTableStateError('No active hand');
  }

  const turn = state.table.activeSeatIndex;
  if (turn == null || turn !== seatIndex) {
    throw new OutOfTurnError('Action out of turn');
  }

  const p = getPlayerAtSeat(state, seatIndex);
  if (p == null || p.hasFolded || p.isSittingOut || p.isAllIn) {
    throw new InvalidActionError('Player cannot act');
  }

  const players = clonePlayers(state.playersById);
  let nextHand = hand;

  switch (action.kind) {
    case 'fold': {
      players[p.playerId] = Object.freeze({ ...p, hasFolded: true });
      nextHand = Object.freeze({
        ...hand,
        actedSeatIndexes: appendActedSeat(hand, seatIndex),
      });
      break;
    }
    case 'check': {
      if (p.currentBet !== hand.currentBet) {
        throw new CannotCheckError('Cannot check while facing a bet');
      }
      nextHand = Object.freeze({
        ...hand,
        actedSeatIndexes: appendActedSeat(hand, seatIndex),
      });
      break;
    }
    case 'call': {
      if (hand.currentBet <= p.currentBet) {
        throw new CannotCallError('Nothing to call');
      }
      const gap = hand.currentBet - p.currentBet;
      const pay = Math.min(gap, p.chips);
      const chips = p.chips - pay;
      const currentBet = p.currentBet + pay;
      const totalCommitted = p.totalCommitted + pay;
      const isAllIn = chips === 0 && pay > 0;
      players[p.playerId] = Object.freeze({
        ...p,
        chips,
        currentBet,
        totalCommitted,
        isAllIn,
      });
      nextHand = Object.freeze({
        ...hand,
        actedSeatIndexes: appendActedSeat(hand, seatIndex),
      });
      break;
    }
    case 'raise': {
      const target = action.amount;
      const maxTotal = p.currentBet + p.chips;
      const minLegal = hand.currentBet + hand.minRaise;

      if (target <= hand.currentBet) {
        throw new CannotRaiseError('Raise target must exceed current bet');
      }
      if (target > maxTotal) {
        throw new InsufficientChipsError('Raise exceeds stack');
      }
      if (target < minLegal && target < maxTotal) {
        throw new CannotRaiseError('Raise below minimum increment');
      }

      const additional = target - p.currentBet;
      const chips = p.chips - additional;
      const isAllIn = chips === 0;

      players[p.playerId] = Object.freeze({
        ...p,
        chips,
        currentBet: target,
        totalCommitted: p.totalCommitted + additional,
        isAllIn,
      });

      const increment = target - hand.currentBet;
      const fullRaise = increment >= hand.minRaise;

      let acted: readonly SeatIndex[];
      let nextMinRaise = hand.minRaise;
      let nextLastRaise = hand.lastRaiseAmount;

      if (fullRaise) {
        acted = resetActedAfterAggression(seatIndex);
        nextMinRaise = increment;
        nextLastRaise = increment;
      } else {
        acted = appendActedSeat(hand, seatIndex);
      }

      nextHand = Object.freeze({
        ...hand,
        currentBet: target,
        actedSeatIndexes: acted,
        lastAggressorSeatIndex: seatIndex,
        minRaise: nextMinRaise,
        lastRaiseAmount: nextLastRaise,
      });
      break;
    }
    case 'allin': {
      if (p.chips <= 0) {
        throw new InvalidActionError('No chips to go all-in');
      }

      const target = p.currentBet + p.chips;
      const pay = p.chips;
      players[p.playerId] = Object.freeze({
        ...p,
        chips: 0,
        currentBet: target,
        totalCommitted: p.totalCommitted + pay,
        isAllIn: true,
      });

      let acted: readonly SeatIndex[];
      let nextBet = hand.currentBet;
      let nextAgg = hand.lastAggressorSeatIndex;
      let nextMinRaise = hand.minRaise;
      let nextLastRaise = hand.lastRaiseAmount;

      if (target > hand.currentBet) {
        const increment = target - hand.currentBet;
        nextBet = target;
        nextAgg = seatIndex;
        const fullRaise = increment >= hand.minRaise;
        if (fullRaise) {
          acted = resetActedAfterAggression(seatIndex);
          nextMinRaise = increment;
          nextLastRaise = increment;
        } else {
          acted = appendActedSeat(hand, seatIndex);
        }
      } else {
        acted = appendActedSeat(hand, seatIndex);
      }

      nextHand = Object.freeze({
        ...hand,
        currentBet: nextBet,
        lastAggressorSeatIndex: nextAgg,
        actedSeatIndexes: acted,
        minRaise: nextMinRaise,
        lastRaiseAmount: nextLastRaise,
      });
      break;
    }
  }

  let next: CoreGameState = Object.freeze({
    ...state,
    playersById: Object.freeze(players),
    hand: nextHand,
  });

  next = mergeHandPotTotal(next);

  if (isBettingRoundComplete(next)) {
    return Object.freeze({
      ...next,
      table: Object.freeze({
        ...next.table,
        activeSeatIndex: null,
      }),
    });
  }

  return advanceTurnAfterAction(next);
}
