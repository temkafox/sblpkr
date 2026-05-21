import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { CorePlayerAction } from '../domain/player-action';
import type { SeatIndex } from '../domain/seat';

import {
  appendActedSeat,
  advanceTurnAfterAction,
  isBettingRoundComplete,
  mergeHandPotTotal,
} from './betting-round';
import {
  CannotCallError,
  CannotCheckError,
  CannotRaiseError,
  InsufficientChipsError,
  InvalidActionError,
  InvalidTableStateError,
  NotInHandError,
  OutOfTurnError,
} from './errors';
import { isHandParticipant } from './hand-participants';
import { requireIntegerChipAmount } from './chip-amount';
import { applyAggressiveBetMetadata, getMinimumRaiseTarget } from './min-raise';
import { recordPublicSeatAction } from './public-seat-action';
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

  if (hand.showdownReady || hand.street === 'SHOWDOWN') {
    throw new InvalidTableStateError('Betting closed');
  }

  if (!isHandParticipant(state, seatIndex)) {
    throw new NotInHandError('Player is not in the current hand');
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

  let nextState: CoreGameState;

  switch (action.kind) {
    case 'fold': {
      players[p.playerId] = Object.freeze({ ...p, hasFolded: true });
      nextState = Object.freeze({
        ...state,
        playersById: Object.freeze(players),
        hand: recordPublicSeatAction(
          Object.freeze({
            ...hand,
            actedSeatIndexes: appendActedSeat(hand, seatIndex),
          }),
          seatIndex,
          { kind: 'fold' },
        ),
      });
      break;
    }
    case 'check': {
      if (p.currentBet !== hand.currentBet) {
        throw new CannotCheckError('Cannot check while facing a bet');
      }
      nextState = Object.freeze({
        ...state,
        playersById: Object.freeze(players),
        hand: recordPublicSeatAction(
          Object.freeze({
            ...hand,
            actedSeatIndexes: appendActedSeat(hand, seatIndex),
          }),
          seatIndex,
          { kind: 'check' },
        ),
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
      nextState = Object.freeze({
        ...state,
        playersById: Object.freeze(players),
        hand: recordPublicSeatAction(
          Object.freeze({
            ...hand,
            actedSeatIndexes: appendActedSeat(hand, seatIndex),
          }),
          seatIndex,
          isAllIn
            ? { kind: 'allin', amount: currentBet }
            : { kind: 'call', amount: pay },
        ),
      });
      break;
    }
    case 'raise': {
      const target = requireIntegerChipAmount(action.amount, 'Raise amount');
      const maxTotal = p.currentBet + p.chips;
      const minLegal = getMinimumRaiseTarget(state);

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

      players[p.playerId] = Object.freeze({
        ...p,
        chips,
        currentBet: target,
        totalCommitted: p.totalCommitted + additional,
        isAllIn: chips === 0,
      });

      const interim = Object.freeze({
        ...state,
        playersById: Object.freeze(players),
        hand,
      });

      {
        const withMeta = applyAggressiveBetMetadata(
          interim,
          seatIndex,
          hand.currentBet,
          target,
        );
        nextState = Object.freeze({
          ...withMeta,
          hand: recordPublicSeatAction(withMeta.hand!, seatIndex, {
            kind: 'raise',
            amount: target,
          }),
        });
      }
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

      const interim = Object.freeze({
        ...state,
        playersById: Object.freeze(players),
        hand,
      });

      if (target > hand.currentBet) {
        const withMeta = applyAggressiveBetMetadata(
          interim,
          seatIndex,
          hand.currentBet,
          target,
        );
        nextState = Object.freeze({
          ...withMeta,
          hand: recordPublicSeatAction(withMeta.hand!, seatIndex, {
            kind: 'allin',
            amount: target,
          }),
        });
      } else {
        nextState = Object.freeze({
          ...interim,
          hand: recordPublicSeatAction(
            Object.freeze({
              ...hand,
              actedSeatIndexes: appendActedSeat(hand, seatIndex),
            }),
            seatIndex,
            { kind: 'allin', amount: target },
          ),
        });
      }
      break;
    }
  }

  nextState = mergeHandPotTotal(nextState);

  if (isBettingRoundComplete(nextState)) {
    return Object.freeze({
      ...nextState,
      table: Object.freeze({
        ...nextState.table,
        activeSeatIndex: null,
      }),
    });
  }

  return advanceTurnAfterAction(nextState);
}
