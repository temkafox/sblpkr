import { describe, expect, it } from 'vitest';

import type { CoreGameState } from '../domain/game-state';
import type { HandState } from '../domain/hand-state';
import type { PlayerRuntimeState } from '../domain/player-state';

import {
  calculateSidePotBreakdown,
  calculateSidePots,
  createInitialGameState,
  createSeededRandom,
  getContributorSeatIndexesForLevel,
  getEligibleSeatIndexesForLevel,
  getTotalCommitted,
  startHand,
  syncPotsFromCommitments,
} from '../index';

const rng = createSeededRandom('phase4d1-sidepots');

function assertAccounting(g: CoreGameState): void {
  const b = calculateSidePotBreakdown(g);
  const total = getTotalCommitted(g);
  const contested = b.contestedSidePots.reduce((s, p) => s + p.amount, 0);
  const ret = b.returnableUncalledBySeatIndex.reduce((s, x) => s + x.amount, 0);
  expect(contested + ret).toBe(total);
  for (const p of b.contestedSidePots) {
    expect(p.eligibleSeatIndexes.length).toBeGreaterThan(0);
  }
}

/** Builds a roster where each participant already locked `totalCommitted` chips into the pot. */

function commitsOnlyGame(
  rows: readonly {
    readonly playerId: string;
    readonly seatIndex: number;
    readonly totalCommitted: number;
    readonly hasFolded?: boolean;
    readonly isSittingOut?: boolean;
  }[],
): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'pots-t',
      maxSeats: 9,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: rows.map((r) => ({
      playerId: r.playerId,
      seatIndex: r.seatIndex,
      startingChips: 1000,
    })),
  });

  const playersById: Record<string, PlayerRuntimeState> = Object.create(null);
  for (const r of rows) {
    const starter = base.playersById[r.playerId]!;
    playersById[r.playerId] = Object.freeze({
      ...starter,
      totalCommitted: r.totalCommitted,
      hasFolded: r.hasFolded ?? false,
      isSittingOut: r.isSittingOut ?? false,
      chips: starter.chips - r.totalCommitted,
      currentBet: 0,
    });
  }

  return Object.freeze({
    ...base,
    playersById: Object.freeze(playersById),
  });
}

/** `syncPotsFromCommitments` no-ops without `hand`; tests that need sync use this stub. */

function withStubHand(state: CoreGameState): CoreGameState {
  const stubPot = Object.freeze({ total: 0, sidePots: Object.freeze([]) });
  const stubHand: HandState = Object.freeze({
    handId: 'stub',
    street: 'PRE-FLOP',
    deck: Object.freeze([]),
    boardCards: Object.freeze([]),
    pots: stubPot,
    currentBet: 0,
    minRaise: 0,
    lastRaiseAmount: 0,
    lastAggressorSeatIndex: null,
    actedSeatIndexes: Object.freeze([]),
    lastPublicActionsBySeat: Object.freeze({}),
    raiseFrozenSeatIndexes: Object.freeze([]),
    showdownReady: false,
    isComplete: false,
  });
  return Object.freeze({ ...state, hand: stubHand });
}

function huStarted(): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'hu',
      maxSeats: 4,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [
      { playerId: 'sb', seatIndex: 0, startingChips: 100 },
      { playerId: 'bb', seatIndex: 3, startingChips: 100 },
    ],
  });

  return startHand(
    Object.freeze({
      ...base,
      table: Object.freeze({ ...base.table, dealerSeatIndex: 3 }),
    }),
    { rng },
  );
}

describe('calculateSidePotBreakdown', () => {
  it('returns empty contested pots when nobody committed', () => {
    const g = createInitialGameState({
      table: {
        tableId: 'idle',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'a', seatIndex: 0, startingChips: 500 },
        { playerId: 'b', seatIndex: 1, startingChips: 500 },
      ],
    });

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toEqual([]);
    expect(b.returnableUncalledBySeatIndex).toEqual([]);
    expect(b.deadMoneyMergedIntoLastContestedPot).toBe(0);
    expect(getTotalCommitted(g)).toBe(0);
    assertAccounting(g);
  });

  it('ignores seated players with zero commitment for layers', () => {
    const g = commitsOnlyGame([
      { playerId: 'active', seatIndex: 1, totalCommitted: 25 },
      { playerId: 'idle', seatIndex: 4, totalCommitted: 0 },
    ]);

    expect(calculateSidePots(g)).toHaveLength(1);
    expect(calculateSidePots(g)[0]!.amount).toBe(25);
    assertAccounting(g);
  });

  it('handles blinds-only heads-up stacks', () => {
    const g = huStarted();

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(2);
    expect(b.contestedSidePots[0]!.amount).toBe(10);
    expect(new Set(b.contestedSidePots[0]!.eligibleSeatIndexes).size).toBe(2);

    expect(b.contestedSidePots[1]!.amount).toBe(5);
    expect(b.contestedSidePots[1]!.eligibleSeatIndexes).toEqual([3]);

    expect(b.returnableUncalledBySeatIndex).toHaveLength(0);
    expect(b.deadMoneyMergedIntoLastContestedPot).toBe(0);
    assertAccounting(g);
  });

  it('creates one contested pot when commitments match', () => {
    const g = commitsOnlyGame([
      { playerId: 'a', seatIndex: 1, totalCommitted: 50 },
      { playerId: 'b', seatIndex: 3, totalCommitted: 50 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(1);
    expect(b.contestedSidePots[0]!.amount).toBe(100);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes.slice().sort()).toEqual([
      1, 3,
    ]);
    assertAccounting(g);
  });

  it('treats folded contributions as dead money inside contested pots (not uncalled)', () => {
    const g = commitsOnlyGame([
      { playerId: 'folder', seatIndex: 1, totalCommitted: 50, hasFolded: true },
      { playerId: 'hero', seatIndex: 3, totalCommitted: 50 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(1);
    expect(b.contestedSidePots[0]!.amount).toBe(100);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes).toEqual([3]);
    expect(b.returnableUncalledBySeatIndex).toHaveLength(0);
    assertAccounting(g);
  });

  it('builds main + side pot when one stack is shorter', () => {
    const g = commitsOnlyGame([
      { playerId: 'short', seatIndex: 1, totalCommitted: 50 },
      { playerId: 'deep', seatIndex: 3, totalCommitted: 120 },
      { playerId: 'deep2', seatIndex: 5, totalCommitted: 120 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(2);

    expect(b.contestedSidePots[0]!.amount).toBe(150);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes.slice().sort()).toEqual([
      1, 3, 5,
    ]);

    expect(b.contestedSidePots[1]!.amount).toBe(140);
    expect(b.contestedSidePots[1]!.eligibleSeatIndexes.slice().sort()).toEqual([
      3, 5,
    ]);

    assertAccounting(g);
  });

  it('handles three staggered stacks (10 / 25 / 100)', () => {
    const g = commitsOnlyGame([
      { playerId: 'a', seatIndex: 1, totalCommitted: 10 },
      { playerId: 'b', seatIndex: 3, totalCommitted: 25 },
      { playerId: 'c', seatIndex: 5, totalCommitted: 100 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(3);
    expect(b.contestedSidePots.map((p) => p.amount)).toEqual([30, 30, 75]);

    expect(b.contestedSidePots[0]!.eligibleSeatIndexes.slice().sort()).toEqual([
      1, 3, 5,
    ]);
    expect(b.contestedSidePots[1]!.eligibleSeatIndexes.slice().sort()).toEqual([
      3, 5,
    ]);
    expect(b.contestedSidePots[2]!.eligibleSeatIndexes).toEqual([5]);

    assertAccounting(g);
  });

  it('records dead money from folded-only upper tier without treating it as uncalled', () => {
    const g = commitsOnlyGame([
      {
        playerId: 'folder',
        seatIndex: 1,
        totalCommitted: 100,
        hasFolded: true,
      },
      { playerId: 'x', seatIndex: 3, totalCommitted: 50 },
      { playerId: 'y', seatIndex: 5, totalCommitted: 50 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(1);
    expect(b.contestedSidePots[0]!.amount).toBe(200);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes.slice().sort()).toEqual([
      3, 5,
    ]);
    expect(b.returnableUncalledBySeatIndex).toHaveLength(0);
    expect(b.deadMoneyMergedIntoLastContestedPot).toBe(50);
    assertAccounting(g);
  });

  it('models uncalled hero overbet heads-up when villain folded early', () => {
    const g = commitsOnlyGame([
      { playerId: 'folder', seatIndex: 1, totalCommitted: 50, hasFolded: true },
      { playerId: 'hero', seatIndex: 3, totalCommitted: 150 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(1);
    expect(b.contestedSidePots[0]!.amount).toBe(100);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes).toEqual([3]);

    expect(b.returnableUncalledBySeatIndex).toEqual([
      { seatIndex: 3, amount: 100 },
    ]);
    expect(b.deadMoneyMergedIntoLastContestedPot).toBe(0);

    expect(calculateSidePots(g)[0]!.amount).toBe(100);
    assertAccounting(g);
  });

  it('models uncalled excess with two live players', () => {
    const g = commitsOnlyGame([
      { playerId: 'short', seatIndex: 1, totalCommitted: 50 },
      { playerId: 'deep', seatIndex: 3, totalCommitted: 150 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(1);
    expect(b.contestedSidePots[0]!.amount).toBe(100);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes.slice().sort()).toEqual([
      1, 3,
    ]);

    expect(b.returnableUncalledBySeatIndex).toEqual([
      { seatIndex: 3, amount: 100 },
    ]);
    assertAccounting(g);
  });

  it('covers heads-up equal all-in totals', () => {
    const g = commitsOnlyGame([
      { playerId: 'a', seatIndex: 0, totalCommitted: 100 },
      { playerId: 'b', seatIndex: 3, totalCommitted: 100 },
    ]);

    const b = calculateSidePotBreakdown(g);

    expect(b.contestedSidePots).toHaveLength(1);
    expect(b.contestedSidePots[0]!.amount).toBe(200);
    expect(b.contestedSidePots[0]!.eligibleSeatIndexes.slice().sort()).toEqual([
      0, 3,
    ]);
    expect(b.returnableUncalledBySeatIndex).toHaveLength(0);
    assertAccounting(g);
  });

  it('covers three-way unequal all-ins', () => {
    const g = commitsOnlyGame([
      { playerId: 'a', seatIndex: 1, totalCommitted: 40 },
      { playerId: 'b', seatIndex: 3, totalCommitted: 80 },
      { playerId: 'c', seatIndex: 5, totalCommitted: 200 },
    ]);

    const b = calculateSidePotBreakdown(g);

    assertAccounting(g);
    expect(b.contestedSidePots).toHaveLength(3);
    expect(b.contestedSidePots.map((p) => p.amount)).toEqual([120, 80, 120]);
    expect(b.returnableUncalledBySeatIndex).toHaveLength(0);
  });

  it('does not mutate the incoming snapshot', () => {
    const g = commitsOnlyGame([
      { playerId: 'a', seatIndex: 1, totalCommitted: 25 },
      { playerId: 'b', seatIndex: 3, totalCommitted: 40 },
    ]);

    const frozen = Object.freeze({
      ...g,
      playersById: Object.freeze({ ...g.playersById }),
    }) as CoreGameState;

    const snap = frozen.playersById.a!.totalCommitted;

    calculateSidePotBreakdown(frozen);

    expect(frozen.playersById.a!.totalCommitted).toBe(snap);
  });
});

describe('helpers', () => {
  it('getEligibleSeatIndexesForLevel mirrors showdown-ready eligibility cuts', () => {
    const g = commitsOnlyGame([
      { playerId: 'folder', seatIndex: 2, totalCommitted: 40, hasFolded: true },
      { playerId: 'alive', seatIndex: 5, totalCommitted: 40 },
    ]);

    expect(getEligibleSeatIndexesForLevel(g, 40)).toEqual([5]);
    expect(getContributorSeatIndexesForLevel(g, 40).slice().sort()).toEqual([
      2, 5,
    ]);
  });

  it('syncPotsFromCommitments stores contested pots and optional audit fields', () => {
    let g = huStarted();

    const tableBefore = g.table;

    g = syncPotsFromCommitments(g);

    expect(g.hand?.pots.total).toBe(getTotalCommitted(g));
    expect(g.hand!.pots.sidePots.length).toBeGreaterThan(0);
    expect(g.table).toBe(tableBefore);

    const over = withStubHand(
      commitsOnlyGame([
        { playerId: 'short', seatIndex: 1, totalCommitted: 50 },
        { playerId: 'deep', seatIndex: 3, totalCommitted: 150 },
      ]),
    );

    const synced = syncPotsFromCommitments(over);

    expect(synced.hand!.pots.returnableUncalled).toHaveLength(1);
    expect(synced.hand!.pots.returnableUncalled![0]!.seatIndex).toBe(3);
    expect(synced.hand!.pots.returnableUncalled![0]!.amount).toBe(100);
  });
});
