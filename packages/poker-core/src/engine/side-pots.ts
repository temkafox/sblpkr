import type { SeatChipSlice, SidePot } from '@neonpoker/shared';

import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { SeatIndex } from '../domain/seat';

import { PokerCoreError } from './errors';
import { sumTotalCommitted } from './betting-round';

/** Sum of every player's `totalCommitted` — authoritative chip conservation check. */

export function getTotalCommitted(state: CoreGameState): number {
  return sumTotalCommitted(state);
}

function sortUniqueSeats(seats: SeatIndex[]): readonly SeatIndex[] {
  return Object.freeze([...new Set(seats)].sort((a, b) => a - b));
}

/** Seats still contesting winnings at this contribution threshold (folded / sit‑out excluded). */

export function getEligibleSeatIndexesForLevel(
  state: CoreGameState,
  level: number,
): readonly SeatIndex[] {
  const seats: SeatIndex[] = [];
  for (const pid of Object.keys(state.playersById)) {
    const p = state.playersById[pid]!;
    if (
      !p.hasFolded &&
      !p.isSittingOut &&
      p.totalCommitted >= level
    ) {
      seats.push(p.seatIndex);
    }
  }
  return sortUniqueSeats(seats);
}

/** Seats whose cumulative commitments reach `level`, including folded contributors (chip physics only). */

export function getContributorSeatIndexesForLevel(
  state: CoreGameState,
  level: number,
): readonly SeatIndex[] {
  const seats: SeatIndex[] = [];
  for (const pid of Object.keys(state.playersById)) {
    const p = state.playersById[pid]!;
    if (p.totalCommitted >= level) {
      seats.push(p.seatIndex);
    }
  }
  return sortUniqueSeats(seats);
}

function uniquePositiveLevels(state: CoreGameState): number[] {
  const levels = new Set<number>();
  for (const pid of Object.keys(state.playersById)) {
    const c = state.playersById[pid]!.totalCommitted;
    if (c > 0) levels.add(c);
  }
  return [...levels].sort((a, b) => a - b);
}

function playerRows(state: CoreGameState): PlayerRuntimeState[] {
  return Object.keys(state.playersById).map((pid) => state.playersById[pid]!);
}

/**
 * Infer chips that never faced matching opposition (true uncalled bets).
 *
 * **Heads-up chip geometry only** (`<= 2` players with `totalCommitted > 0`): compare the two
 * stacks — either both live (deep vs short), or one live vs one folder — so unmatched tails are
 * split out as refunds.
 *
 * With **3+ players** contributing chips, staggered stacks form side pots via layered math only —
 * inference returns empty there (including **one live survivor + multiple folders**: layering +
 * dead-money merge captures chip physics without a misleading `max − second` refund).
 *
 * Ignores HU blind-posting geometry (`smallBlind`/`bigBlind` posted while both remain eligible).
 */

export function inferUncalledReturnableSlices(
  state: CoreGameState,
): readonly SeatChipSlice[] {
  const rows = playerRows(state).filter((p) => p.totalCommitted > 0);
  if (rows.length < 2) {
    return Object.freeze([]);
  }

  const sorted = [...rows].sort((a, b) => a.totalCommitted - b.totalCommitted);
  const min = sorted[0]!.totalCommitted;
  const maxAll = sorted[sorted.length - 1]!.totalCommitted;

  const blindHuSkip =
    sorted.length === 2 &&
    min === state.table.smallBlind &&
    maxAll === state.table.bigBlind &&
    sorted.every((p) => !p.hasFolded && !p.isSittingOut);

  if (blindHuSkip) {
    return Object.freeze([]);
  }

  const liveRows = sorted.filter((p) => !p.hasFolded && !p.isSittingOut);
  if (liveRows.length === 0) {
    return Object.freeze([]);
  }

  const topLiveAtGlobalMax = liveRows.filter((p) => p.totalCommitted === maxAll);

  if (topLiveAtGlobalMax.length !== 1) {
    return Object.freeze([]);
  }

  const hero = topLiveAtGlobalMax[0]!;

  let opponentCap: number;

  if (liveRows.length >= 3) {
    return Object.freeze([]);
  }

  if (liveRows.length === 2) {
    const sortedLive = [...liveRows].sort(
      (a, b) => a.totalCommitted - b.totalCommitted,
    );
    opponentCap = sortedLive[sortedLive.length - 2]!.totalCommitted;
  } else {
    if (sorted.length !== 2) {
      return Object.freeze([]);
    }

    opponentCap = sorted[sorted.length - 2]!.totalCommitted;
  }

  const excess = hero.totalCommitted - opponentCap;
  if (excess <= 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      seatIndex: hero.seatIndex,
      amount: excess,
    }),
  ]);
}

function withVirtualCommitments(
  state: CoreGameState,
  deductions: ReadonlyMap<SeatIndex, number>,
): CoreGameState {
  const playersById: Record<string, PlayerRuntimeState> = Object.create(null);
  for (const pid of Object.keys(state.playersById)) {
    const p = state.playersById[pid]!;
    const sub = deductions.get(p.seatIndex) ?? 0;
    const nextCommitted = p.totalCommitted - sub;
    if (nextCommitted < 0) {
      throw new PokerCoreError('Negative virtual commitment during side-pot math');
    }
    playersById[pid] = Object.freeze({
      ...p,
      totalCommitted: nextCommitted,
      chips: p.chips + sub,
    });
  }
  return Object.freeze({
    ...state,
    playersById: Object.freeze(playersById),
  });
}

/**
 * Builds contested pots only — assumes commitments already exclude uncalled tails.
 *
 * Folded-only tiers accumulate dead money merged explicitly into the last contested slice.
 */

function calculateContestedSidePotsInternal(
  state: CoreGameState,
): { readonly contestedSidePots: readonly SidePot[]; readonly deadMergedIntoLast: number } {
  const levels = uniquePositiveLevels(state);
  const contestedPots: SidePot[] = [];
  let pendingDead = 0;
  let deadMergedIntoLast = 0;

  let prevLevel = 0;

  for (const level of levels) {
    const slice = level - prevLevel;
    if (slice <= 0) {
      prevLevel = level;
      continue;
    }

    const contributorSeats = getContributorSeatIndexesForLevel(state, level);
    const eligibleSeats = getEligibleSeatIndexesForLevel(state, level);
    const contributorCount = contributorSeats.length;
    const rawAmount = slice * contributorCount;

    if (rawAmount <= 0) {
      prevLevel = level;
      continue;
    }

    if (eligibleSeats.length === 0) {
      pendingDead += rawAmount;
      prevLevel = level;
      continue;
    }

    const amount = rawAmount + pendingDead;
    pendingDead = 0;

    contestedPots.push(
      Object.freeze({
        amount,
        eligibleSeatIndexes: eligibleSeats,
      }),
    );

    prevLevel = level;
  }

  if (pendingDead > 0) {
    if (contestedPots.length === 0) {
      throw new PokerCoreError(
        `Dead money (${pendingDead}) has no contested pot to attach`,
      );
    }

    const last = contestedPots[contestedPots.length - 1]!;
    deadMergedIntoLast = pendingDead;
    contestedPots[contestedPots.length - 1] = Object.freeze({
      ...last,
      amount: last.amount + pendingDead,
    });
    pendingDead = 0;
  }

  return {
    contestedSidePots: Object.freeze(contestedPots),
    deadMergedIntoLast,
  };
}

export type SidePotBreakdown = {
  readonly contestedSidePots: readonly SidePot[];
  readonly returnableUncalledBySeatIndex: readonly SeatChipSlice[];
  readonly deadMoneyMergedIntoLastContestedPot: number;
};

/**
 * Separates uncalled tails (refunds owed outside contested pots) from contested pots.
 * Folded-only upper tiers remain **dead money** merged with an explicit audit flag — never silent uncalled merges.
 */

export function calculateSidePotBreakdown(
  state: CoreGameState,
): SidePotBreakdown {
  const returnSlices = inferUncalledReturnableSlices(state);

  const deductions = new Map<SeatIndex, number>();
  for (const slice of returnSlices) {
    deductions.set(slice.seatIndex, slice.amount);
  }

  const adjusted =
    returnSlices.length === 0 ? state : withVirtualCommitments(state, deductions);

  const { contestedSidePots, deadMergedIntoLast } =
    calculateContestedSidePotsInternal(adjusted);

  const contestedSum = contestedSidePots.reduce((s, p) => s + p.amount, 0);
  const returnSum = returnSlices.reduce((s, x) => s + x.amount, 0);
  const expected = getTotalCommitted(state);

  if (contestedSum + returnSum !== expected) {
    throw new PokerCoreError(
      `Side pot breakdown mismatch: contested ${contestedSum} + returnable ${returnSum} !== committed ${expected}`,
    );
  }

  for (const p of contestedSidePots) {
    if (p.eligibleSeatIndexes.length === 0) {
      throw new PokerCoreError('Contested pot lacks eligible winners');
    }
  }

  return Object.freeze({
    contestedSidePots,
    returnableUncalledBySeatIndex: Object.freeze([...returnSlices]),
    deadMoneyMergedIntoLastContestedPot: deadMergedIntoLast,
  });
}

/** Contested pots only — excludes uncalled tails listed in {@link calculateSidePotBreakdown}. */

export function calculateSidePots(state: CoreGameState): readonly SidePot[] {
  return calculateSidePotBreakdown(state).contestedSidePots;
}

/** Persists contested slices plus optional uncalled/dead-money audit fields on `hand.pots`. */

export function syncPotsFromCommitments(state: CoreGameState): CoreGameState {
  if (state.hand == null) return state;

  const breakdown = calculateSidePotBreakdown(state);
  const total = getTotalCommitted(state);

  const pots = Object.freeze({
    total,
    sidePots: breakdown.contestedSidePots,
    ...(breakdown.returnableUncalledBySeatIndex.length > 0
      ? {
          returnableUncalled: breakdown.returnableUncalledBySeatIndex,
        }
      : {}),
    ...(breakdown.deadMoneyMergedIntoLastContestedPot > 0
      ? {
          deadMoneyMergedIntoLastContestedPot:
            breakdown.deadMoneyMergedIntoLastContestedPot,
        }
      : {}),
  });

  const hand = Object.freeze({
    ...state.hand,
    pots,
  });

  return Object.freeze({ ...state, hand });
}
