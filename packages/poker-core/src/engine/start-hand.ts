import type { Pot } from '@neonpoker/shared';

import type { Card } from '../domain/card';
import { createDeck, shuffleDeck } from '../domain/deck';
import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { HandState } from '../domain/hand-state';
import type { RandomSource } from '../domain/random';
import type { PlayerId } from '../domain/seat';

import { InvalidTableStateError, NotEnoughPlayersError } from './errors';
import {
  getActiveSeatOrderClockwiseFrom,
  getActiveSeatIndexes,
  getBigBlindSeatIndex,
  getFirstToActPreflop,
  getNextActiveSeatIndex,
  getPlayerAtSeat,
  getSmallBlindSeatIndex,
} from './seat-utils';

export type StartHandOptions = {
  readonly rng: RandomSource;
  readonly handId?: string;
};

function resetPlayerForNewHand(player: PlayerRuntimeState): PlayerRuntimeState {
  return Object.freeze({
    ...player,
    holeCards: Object.freeze([]),
    currentBet: 0,
    totalCommitted: 0,
    hasFolded: false,
    isAllIn: false,
  });
}

function applyBlindPost(
  player: PlayerRuntimeState,
  blindAmount: number,
): PlayerRuntimeState {
  const post = Math.min(blindAmount, player.chips);
  const chips = player.chips - post;
  const isAllIn = chips === 0 && post > 0;
  return Object.freeze({
    ...player,
    chips,
    currentBet: player.currentBet + post,
    totalCommitted: player.totalCommitted + post,
    isAllIn,
  });
}

/**
 * Starts a new hold'em hand: button rotation, blinds, deal, preflop pointers.
 * Pure + immutable — **no** applyAction / street engine (Phase 4B+).
 */

export function startHand(
  state: CoreGameState,
  options: StartHandOptions,
): CoreGameState {
  if (state.hand !== null && !state.hand.isComplete) {
    throw new InvalidTableStateError('Cannot start a new hand while one is active');
  }

  const activeSeats = getActiveSeatIndexes(state);
  if (activeSeats.length < 2) {
    throw new NotEnoughPlayersError('At least two active players are required to start');
  }

  const newDealer = getNextActiveSeatIndex(state, state.table.dealerSeatIndex);

  const stateWithButton: CoreGameState = Object.freeze({
    ...state,
    table: Object.freeze({
      ...state.table,
      dealerSeatIndex: newDealer,
    }),
  });

  const sbSeat = getSmallBlindSeatIndex(stateWithButton, newDealer);
  const bbSeat = getBigBlindSeatIndex(stateWithButton, sbSeat);
  const firstActor = getFirstToActPreflop(stateWithButton);

  const sbPlayerId = stateWithButton.table.seats[sbSeat]?.playerId;
  const bbPlayerId = stateWithButton.table.seats[bbSeat]?.playerId;
  if (sbPlayerId == null || bbPlayerId == null) {
    throw new InvalidTableStateError('Blind seats must be occupied');
  }

  const playersAfterReset: Record<PlayerId, PlayerRuntimeState> =
    Object.create(null);
  for (const pid of Object.keys(stateWithButton.playersById)) {
    const p = stateWithButton.playersById[pid]!;
    playersAfterReset[pid] = resetPlayerForNewHand(p);
  }

  const shuffled = shuffleDeck(createDeck(), options.rng);
  let ptr = 0;
  const takeCard = (): Card => {
    const c = shuffled[ptr]!;
    ptr += 1;
    return c;
  };

  const dealOrder = getActiveSeatOrderClockwiseFrom(stateWithButton, sbSeat);
  const holeByPlayer: Record<PlayerId, Card[]> = Object.create(null);
  for (const seat of dealOrder) {
    const pl = getPlayerAtSeat(stateWithButton, seat);
    if (pl != null) holeByPlayer[pl.playerId] = [];
  }

  for (let r = 0; r < 2; r++) {
    for (const seat of dealOrder) {
      const pl = getPlayerAtSeat(stateWithButton, seat);
      if (pl != null) {
        holeByPlayer[pl.playerId]!.push(takeCard());
      }
    }
  }

  const remainingDeck = Object.freeze(shuffled.slice(ptr));

  for (const pid of Object.keys(holeByPlayer)) {
    const cards = holeByPlayer[pid]!;
    playersAfterReset[pid] = Object.freeze({
      ...playersAfterReset[pid]!,
      holeCards: Object.freeze(cards),
    });
  }

  playersAfterReset[sbPlayerId] = applyBlindPost(
    playersAfterReset[sbPlayerId]!,
    stateWithButton.table.smallBlind,
  );
  playersAfterReset[bbPlayerId] = applyBlindPost(
    playersAfterReset[bbPlayerId]!,
    stateWithButton.table.bigBlind,
  );

  const sbPlayer = playersAfterReset[sbPlayerId]!;
  const bbPlayer = playersAfterReset[bbPlayerId]!;
  const sbPosted = sbPlayer.currentBet;
  const bbPosted = bbPlayer.currentBet;
  const potTotal = sbPosted + bbPosted;

  const pots: Pot = Object.freeze({
    total: potTotal,
    sidePots: Object.freeze([]),
  });

  const boardCards = Object.freeze([] as Card[]);

  const hand: HandState = Object.freeze({
    handId: options.handId ?? 'hand-default',
    street: 'PRE-FLOP',
    deck: remainingDeck,
    boardCards,
    pots,
    currentBet: Math.max(sbPosted, bbPosted),
    minRaise: stateWithButton.table.bigBlind,
    lastRaiseAmount: stateWithButton.table.bigBlind,
    lastAggressorSeatIndex: bbSeat,
    actedSeatIndexes: Object.freeze([]),
    lastPublicActionsBySeat: Object.freeze({
      [sbSeat]: Object.freeze({ kind: 'post_sb', amount: sbPosted }),
      [bbSeat]: Object.freeze({ kind: 'post_bb', amount: bbPosted }),
    }),
    raiseFrozenSeatIndexes: Object.freeze([]),
    showdownReady: false,
    isComplete: false,
  });

  const nextTable = Object.freeze({
    ...stateWithButton.table,
    dealerSeatIndex: newDealer,
    smallBlindSeatIndex: sbSeat,
    bigBlindSeatIndex: bbSeat,
    activeSeatIndex: firstActor,
  });

  const frozenPlayers = Object.freeze(playersAfterReset);

  return Object.freeze({
    ...stateWithButton,
    table: nextTable,
    hand,
    playersById: frozenPlayers,
  });
}
