import type { SeatChipSlice } from '@neonpoker/shared';

import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { SeatIndex } from '../domain/seat';

import { getContestantSeatIndexes } from './betting-round';
import {
  NoEligibleWinnersError,
  PotDistributionError,
  ShowdownNotReadyError,
} from './errors';
import type { EvaluatedHand } from './hand-evaluator';
import {
  compareEvaluatedHands,
  evaluateBestHand,
} from './hand-evaluator';
import type { AwardedAmountsBySeatIndex } from './pot-distribution';
import { splitPotWithOddChipRule } from './pot-distribution';
import { getPlayerAtSeat } from './seat-utils';
import type { SidePotBreakdown } from './side-pots';
import {
  calculateSidePotBreakdown,
  syncPotsFromCommitments,
} from './side-pots';

export type PotResult = {
  readonly potIndex: number;
  readonly amount: number;
  readonly eligibleSeatIndexes: readonly SeatIndex[];
  readonly winningSeatIndexes: readonly SeatIndex[];
  readonly awardedAmountsBySeatIndex: AwardedAmountsBySeatIndex;
  readonly winningHand: EvaluatedHand | null;
};

export type ShowdownResult = {
  readonly winners: readonly SeatIndex[];
  readonly evaluatedHandsBySeatIndex: Readonly<
    Partial<Record<SeatIndex, EvaluatedHand>>
  >;
  readonly potResults: readonly PotResult[];
  readonly totalAwarded: number;
  readonly returnableUncalled: readonly SeatChipSlice[];
};

function clonePlayers(
  playersById: Readonly<Record<string, PlayerRuntimeState>>,
): Record<string, PlayerRuntimeState> {
  const out: Record<string, PlayerRuntimeState> = Object.create(null);
  for (const k of Object.keys(playersById)) {
    out[k] = playersById[k]!;
  }
  return out;
}

function isResolvedTerminal(hand: NonNullable<CoreGameState['hand']>): boolean {
  return hand.isComplete && hand.showdownReady;
}

function isFoldWinContest(state: CoreGameState): boolean {
  return getContestantSeatIndexes(state).length === 1;
}

function assertCanResolve(state: CoreGameState): void {
  const hand = state.hand;
  if (hand == null) {
    throw new ShowdownNotReadyError('No active hand');
  }
  if (isResolvedTerminal(hand)) {
    throw new PotDistributionError('Hand already resolved');
  }

  if (isFoldWinContest(state)) {
    return;
  }

  if (!(hand.showdownReady || hand.street === 'SHOWDOWN')) {
    throw new ShowdownNotReadyError('Showdown has not started');
  }
}

function seatsWithShowdownHoleCards(state: CoreGameState): ReadonlySet<SeatIndex> {
  const out = new Set<SeatIndex>();
  for (const s of state.table.seats) {
    const p = getPlayerAtSeat(state, s.seatIndex);
    if (
      p != null &&
      !p.hasFolded &&
      !p.isSittingOut &&
      p.holeCards.length === 2
    ) {
      out.add(s.seatIndex);
    }
  }
  return out;
}

/**
 * Pure winner analysis — **does not** move chips.
 *
 * Preconditions: showdown street (`SHOWDOWN` / `showdownReady`), board filled (5 cards),
 * at least two contestants with hole cards.
 */

export function determineShowdownWinners(state: CoreGameState): ShowdownResult {
  const hand = state.hand;
  if (hand == null) {
    throw new ShowdownNotReadyError('No active hand');
  }

  if (isFoldWinContest(state)) {
    throw new ShowdownNotReadyError(
      'determineShowdownWinners requires a contested showdown',
    );
  }

  if (!(hand.showdownReady || hand.street === 'SHOWDOWN')) {
    throw new ShowdownNotReadyError('Showdown has not started');
  }

  if (hand.boardCards.length !== 5) {
    throw new ShowdownNotReadyError('Board must have five cards before showdown');
  }

  const showdownSeatFilter = seatsWithShowdownHoleCards(state);
  const contestants = getContestantSeatIndexes(state);
  if (contestants.length < 2) {
    throw new ShowdownNotReadyError('Showdown requires at least two contestants');
  }

  for (const seat of contestants) {
    if (!showdownSeatFilter.has(seat)) {
      throw new ShowdownNotReadyError(
        `Contestant seat ${seat} must have exactly two hole cards at showdown`,
      );
    }
  }

  const breakdown = calculateSidePotBreakdown(state);
  const board = hand.boardCards;

  const evaluatedHandsBySeatIndex: Partial<Record<SeatIndex, EvaluatedHand>> =
    Object.create(null);
  for (const seat of contestants) {
    const p = getPlayerAtSeat(state, seat)!;
    const seven = [...p.holeCards, ...board];
    evaluatedHandsBySeatIndex[seat] = evaluateBestHand(seven);
  }

  const dealer = state.table.dealerSeatIndex;
  const maxSeats = state.table.maxSeats;

  const potResults: PotResult[] = [];
  let totalAwarded = 0;

  breakdown.contestedSidePots.forEach((pot, potIndex) => {
    const eligible = pot.eligibleSeatIndexes.filter((seat) =>
      showdownSeatFilter.has(seat),
    );

    if (eligible.length === 0) {
      throw new NoEligibleWinnersError(
        `Side pot ${potIndex} has no showdown-eligible seats`,
      );
    }

    let bestSeat = eligible[0]!;
    let bestEval = evaluatedHandsBySeatIndex[bestSeat]!;

    for (let i = 1; i < eligible.length; i++) {
      const seat = eligible[i]!;
      const ev = evaluatedHandsBySeatIndex[seat]!;
      if (compareEvaluatedHands(ev, bestEval) > 0) {
        bestSeat = seat;
        bestEval = ev;
      }
    }

    const winningSeatIndexes = eligible.filter(
      (seat) =>
        compareEvaluatedHands(
          evaluatedHandsBySeatIndex[seat]!,
          bestEval,
        ) === 0,
    );

    const awardedAmountsBySeatIndex = splitPotWithOddChipRule(
      pot.amount,
      winningSeatIndexes,
      dealer,
      maxSeats,
    );

    totalAwarded += pot.amount;

    potResults.push(
      Object.freeze({
        potIndex,
        amount: pot.amount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        winningSeatIndexes: Object.freeze([...winningSeatIndexes]),
        awardedAmountsBySeatIndex,
        winningHand: bestEval,
      }),
    );
  });

  const winnerSet = new Set<SeatIndex>();
  for (const pr of potResults) {
    const awards = pr.awardedAmountsBySeatIndex as Record<string, number | undefined>;
    for (const key of Object.keys(awards)) {
      const seat = Number(key) as SeatIndex;
      const amt = awards[key];
      if (amt != null && amt > 0) winnerSet.add(seat);
    }
  }

  return Object.freeze({
    winners: Object.freeze([...winnerSet].sort((a, b) => a - b)),
    evaluatedHandsBySeatIndex: Object.freeze(evaluatedHandsBySeatIndex),
    potResults: Object.freeze(potResults),
    totalAwarded,
    returnableUncalled: breakdown.returnableUncalledBySeatIndex,
  });
}

function determineFoldWinShowdownResult(
  state: CoreGameState,
  breakdown: SidePotBreakdown,
): ShowdownResult {
  const contestantSeats = getContestantSeatIndexes(state);
  if (contestantSeats.length !== 1) {
    throw new PotDistributionError('Fold-win requires exactly one contestant');
  }
  const winnerSeat = contestantSeats[0]!;
  const dealer = state.table.dealerSeatIndex;
  const maxSeats = state.table.maxSeats;

  const potResults: PotResult[] = [];

  breakdown.contestedSidePots.forEach((pot, potIndex) => {
    if (!pot.eligibleSeatIndexes.includes(winnerSeat)) {
      throw new PotDistributionError(
        `Fold-win survivor seat ${winnerSeat} not eligible for pot ${potIndex}`,
      );
    }

    const awardedAmountsBySeatIndex = splitPotWithOddChipRule(
      pot.amount,
      [winnerSeat],
      dealer,
      maxSeats,
    );

    potResults.push(
      Object.freeze({
        potIndex,
        amount: pot.amount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        winningSeatIndexes: Object.freeze([winnerSeat]),
        awardedAmountsBySeatIndex,
        winningHand: null,
      }),
    );
  });

  const totalAwarded = breakdown.contestedSidePots.reduce(
    (s, p) => s + p.amount,
    0,
  );

  return Object.freeze({
    winners: Object.freeze([winnerSeat]),
    evaluatedHandsBySeatIndex: Object.freeze({}),
    potResults: Object.freeze(potResults),
    totalAwarded,
    returnableUncalled: breakdown.returnableUncalledBySeatIndex,
  });
}

function refundSumForSeat(
  slices: readonly SeatChipSlice[],
  seat: SeatIndex,
): number {
  let sum = 0;
  for (const sl of slices) {
    if (sl.seatIndex === seat) sum += sl.amount;
  }
  return sum;
}

function applyChipSettlement(
  state: CoreGameState,
  result: ShowdownResult,
): CoreGameState {
  const hand = state.hand!;
  const awardsBySeat = new Map<SeatIndex, number>();

  for (const pr of result.potResults) {
    for (const seatStr of Object.keys(pr.awardedAmountsBySeatIndex)) {
      const seat = Number(seatStr) as SeatIndex;
      const add = pr.awardedAmountsBySeatIndex[seat] ?? 0;
      awardsBySeat.set(seat, (awardsBySeat.get(seat) ?? 0) + add);
    }
  }

  const players = clonePlayers(state.playersById);

  for (const pid of Object.keys(players)) {
    const p = players[pid]!;
    const potPay = awardsBySeat.get(p.seatIndex) ?? 0;
    const refund = refundSumForSeat(result.returnableUncalled, p.seatIndex);
    players[pid] = Object.freeze({
      ...p,
      chips: p.chips + potPay + refund,
      totalCommitted: 0,
      currentBet: 0,
    });
  }

  const nextHand = Object.freeze({
    ...hand,
    isComplete: true,
    showdownReady: true,
  });

  return Object.freeze({
    ...state,
    playersById: Object.freeze(players),
    hand: nextHand,
    table: Object.freeze({
      ...state.table,
      activeSeatIndex: null,
    }),
  });
}

/**
 * Terminal resolution: sync pots from commitments, compute winners, credit stacks,
 * refund uncalled tails, settle commitments (`totalCommitted` / `currentBet` zeroed),
 * mark `hand.isComplete` + `hand.showdownReady`.
 */

export function resolveShowdown(state: CoreGameState): CoreGameState {
  assertCanResolve(state);

  const synced = syncPotsFromCommitments(state);
  const breakdown = calculateSidePotBreakdown(synced);

  const result = isFoldWinContest(synced)
    ? determineFoldWinShowdownResult(synced, breakdown)
    : determineShowdownWinners(synced);

  return applyChipSettlement(synced, result);
}

/** Alias — identical behavior to {@link resolveShowdown}. */

export function distributePots(state: CoreGameState): CoreGameState {
  return resolveShowdown(state);
}

/** Convenience guard when exactly one contestant remains (fold-down terminal). */

export function resolveFoldWin(state: CoreGameState): CoreGameState {
  if (getContestantSeatIndexes(state).length !== 1) {
    throw new PotDistributionError('resolveFoldWin requires exactly one contestant');
  }
  return resolveShowdown(state);
}
