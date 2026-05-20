import type { Street } from '@neonpoker/shared';

import type { Card } from '../domain/card';
import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { PlayerId } from '../domain/seat';
import type { SeatIndex } from '../domain/seat';

import {
  getContestantSeatIndexes,
  isBettingRoundComplete,
  mergeHandPotTotal,
} from './betting-round';
import { InvalidTableStateError } from './errors';
import { getPlayerAtSeat } from './seat-utils';

function resetPlayersStreetBets(
  playersById: Readonly<Record<PlayerId, PlayerRuntimeState>>,
): Record<PlayerId, PlayerRuntimeState> {
  const out: Record<PlayerId, PlayerRuntimeState> = Object.create(null);
  for (const k of Object.keys(playersById)) {
    const p = playersById[k]!;
    out[k] = Object.freeze({ ...p, currentBet: 0 });
  }
  return out;
}

function assertEnoughDeck(deck: readonly Card[], need: number): void {
  if (deck.length < need) {
    throw new InvalidTableStateError('Deck exhausted');
  }
}

/** First active, non‑folded, non–all‑in seat clockwise from the button. */

export function getFirstToActPostflop(state: CoreGameState): SeatIndex | null {
  const dealer = state.table.dealerSeatIndex;
  const max = state.table.maxSeats;

  for (let step = 1; step <= max; step++) {
    const seat = (dealer + step) % max;
    const p = getPlayerAtSeat(state, seat);
    if (p != null && !p.hasFolded && !p.isSittingOut && !p.isAllIn) {
      return seat;
    }
  }

  return null;
}

export function canAdvanceStreet(state: CoreGameState): boolean {
  const h = state.hand;
  if (h == null || h.isComplete) return false;
  if (h.showdownReady || h.street === 'SHOWDOWN') return false;
  return isBettingRoundComplete(state);
}

function applyCommonStreetReset(
  state: CoreGameState,
  patch: {
    readonly street: Street;
    readonly boardCards: readonly Card[];
    readonly deck: readonly Card[];
    readonly showdownReady: boolean;
    readonly activeSeatIndex: SeatIndex | null;
  },
): CoreGameState {
  const hand = state.hand!;
  const bb = state.table.bigBlind;

  const players = resetPlayersStreetBets(state.playersById);

  const nextHand = Object.freeze({
    ...hand,
    street: patch.street,
    boardCards: patch.boardCards,
    deck: patch.deck,
    currentBet: 0,
    minRaise: bb,
    lastRaiseAmount: bb,
    lastAggressorSeatIndex: null,
    actedSeatIndexes: Object.freeze([]),
    raiseFrozenSeatIndexes: Object.freeze([]),
    showdownReady: patch.showdownReady,
  });

  let next: CoreGameState = Object.freeze({
    ...state,
    playersById: Object.freeze(players),
    hand: nextHand,
    table: Object.freeze({
      ...state.table,
      activeSeatIndex: patch.activeSeatIndex,
    }),
  });

  next = mergeHandPotTotal(next);
  return next;
}

function dealRunOutToRiver(state: CoreGameState): CoreGameState {
  const hand = state.hand!;
  let deck = hand.deck;
  let board = [...hand.boardCards];

  while (board.length < 5) {
    const need = board.length === 0 ? 3 : 1;
    assertEnoughDeck(deck, need);
    board = [...board, ...deck.slice(0, need)];
    deck = deck.slice(need);
  }

  const frozenBoard = Object.freeze(board);
  const frozenDeck = Object.freeze(deck);

  return applyCommonStreetReset(state, {
    street: 'SHOWDOWN',
    boardCards: frozenBoard,
    deck: frozenDeck,
    showdownReady: true,
    activeSeatIndex: null,
  });
}

function advanceOneBoardStreet(
  state: CoreGameState,
  cardsToDeal: number,
  nextStreet: Street,
): CoreGameState {
  const hand = state.hand!;
  assertEnoughDeck(hand.deck, cardsToDeal);

  const dealt = hand.deck.slice(0, cardsToDeal);
  const deck = Object.freeze(hand.deck.slice(cardsToDeal));
  const boardCards = Object.freeze([...hand.boardCards, ...dealt]);

  let next = applyCommonStreetReset(state, {
    street: nextStreet,
    boardCards,
    deck,
    showdownReady: false,
    activeSeatIndex: null,
  });

  const first = getFirstToActPostflop(next);
  next = Object.freeze({
    ...next,
    table: Object.freeze({
      ...next.table,
      activeSeatIndex: first,
    }),
  });

  return next;
}

function foldWinnerTerminal(state: CoreGameState): CoreGameState {
  const hand = state.hand!;
  const nextHand = Object.freeze({
    ...hand,
    isComplete: true,
    showdownReady: false,
  });

  let next: CoreGameState = Object.freeze({
    ...state,
    hand: nextHand,
    table: Object.freeze({
      ...state.table,
      activeSeatIndex: null,
    }),
  });

  next = mergeHandPotTotal(next);
  return next;
}

/** Advances exactly one betting chapter — caller sequences after each closed round (except all‑in runout, which jumps here in one call). */

export function advanceStreet(state: CoreGameState): CoreGameState {
  if (!canAdvanceStreet(state)) {
    throw new InvalidTableStateError('Cannot advance street');
  }

  const hand = state.hand!;
  const contestSeats = getContestantSeatIndexes(state);
  const contenders = contestSeats
    .map((s) => getPlayerAtSeat(state, s))
    .filter((p): p is PlayerRuntimeState => p != null);

  if (contenders.length <= 1) {
    return foldWinnerTerminal(state);
  }

  if (contenders.every((p) => p.isAllIn)) {
    return dealRunOutToRiver(state);
  }

  switch (hand.street) {
    case 'PRE-FLOP':
      return advanceOneBoardStreet(state, 3, 'FLOP');
    case 'FLOP':
      return advanceOneBoardStreet(state, 1, 'TURN');
    case 'TURN':
      return advanceOneBoardStreet(state, 1, 'RIVER');
    case 'RIVER':
      return applyCommonStreetReset(state, {
        street: 'SHOWDOWN',
        boardCards: hand.boardCards,
        deck: hand.deck,
        showdownReady: true,
        activeSeatIndex: null,
      });
    default:
      throw new InvalidTableStateError('Unsupported street advance');
  }
}
