import { describe, expect, it } from 'vitest';

import type { CoreGameState } from '../domain/game-state';
import type { TableState } from '../domain/table-state';
import type { SeatIndex } from '../domain/seat';
import {
  advanceStreet,
  applyAction,
  compareEvaluatedHands,
  createInitialGameState,
  createSeededRandom,
  determineShowdownWinners,
  evaluateBestHand,
  getAvailableActions,
  getOddChipWinner,
  canAdvanceStreet,
  isBettingRoundComplete,
  resolveShowdown,
  startHand,
} from '../index';
import {
  assertChipConservation,
  getTotalWealth,
} from '../test-helpers/chip-conservation';

import { getContestantSeatIndexes } from './betting-round';
import { getPlayerAtSeat } from './seat-utils';

function rng(tag: string): ReturnType<typeof createSeededRandom> {
  return createSeededRandom(`phase5a-full-hand-${tag}`);
}

function tablePatch(
  state: CoreGameState,
  patch: Partial<TableState>,
): CoreGameState {
  return Object.freeze({
    ...state,
    table: Object.freeze({ ...state.table, ...patch }),
  });
}

/** Resolve facing bets using passive check/call only (HU / limped pots). */

function progressPassiveBettingRound(state: CoreGameState): CoreGameState {
  let g = state;
  let guard = 0;
  while (
    g.hand &&
    !g.hand.isComplete &&
    !g.hand.showdownReady &&
    !isBettingRoundComplete(g)
  ) {
    const seat = g.table.activeSeatIndex;
    if (seat == null) break;
    const a = getAvailableActions(g, seat);
    if (a.canCheck) {
      g = applyAction(g, seat, { kind: 'check' });
    } else if (a.canCall) {
      g = applyAction(g, seat, { kind: 'call' });
    } else {
      throw new Error(`progressPassiveBettingRound stuck at seat ${seat}`);
    }
    if (++guard > 120) throw new Error('progressPassiveBettingRound guard');
  }
  return g;
}

/** Advance streets until showdown-ready using check/call-through betting. */

function runPassiveShowdown(state: CoreGameState): CoreGameState {
  let g = state;
  let guard = 0;
  while (
    g.hand &&
    !g.hand.showdownReady &&
    !g.hand.isComplete &&
    guard++ < 40
  ) {
    g = progressPassiveBettingRound(g);
    if (g.hand?.showdownReady) break;
    if (!canAdvanceStreet(g)) break;
    g = advanceStreet(g);
  }
  return g;
}

describe('Phase 5A — full-hand-flow integration', () => {
  it('A. heads-up simple showdown — wealth conserved, stronger hand wins chips', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'a',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'sa', seatIndex: 0, startingChips: 900 },
        { playerId: 'sb', seatIndex: 3, startingChips: 900 },
      ],
    });

    let g = startHand(tablePatch(base, { dealerSeatIndex: 0 }), {
      rng: rng('A'),
    });

    const wealthStart = getTotalWealth(g);

    g = runPassiveShowdown(g);

    expect(g.hand?.showdownReady).toBe(true);
    expect(g.hand?.boardCards.length).toBe(5);

    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;
    const board = g.hand!.boardCards;

    const evSb = evaluateBestHand([
      ...getPlayerAtSeat(g, sbSeat)!.holeCards,
      ...board,
    ]);
    const evBb = evaluateBestHand([
      ...getPlayerAtSeat(g, bbSeat)!.holeCards,
      ...board,
    ]);
    const cmp = compareEvaluatedHands(evSb, evBb);

    const resolved = resolveShowdown(g);
    assertChipConservation(g, resolved);
    expect(getTotalWealth(resolved)).toBe(wealthStart);

    const pidSb = getPlayerAtSeat(resolved, sbSeat)!.playerId;
    const pidBb = getPlayerAtSeat(resolved, bbSeat)!.playerId;
    const gainSb =
      resolved.playersById[pidSb]!.chips - g.playersById[pidSb]!.chips;
    const gainBb =
      resolved.playersById[pidBb]!.chips - g.playersById[pidBb]!.chips;

    if (cmp > 0) {
      expect(gainSb).toBeGreaterThan(0);
      expect(gainBb).toBeLessThanOrEqual(0);
    } else if (cmp < 0) {
      expect(gainBb).toBeGreaterThan(0);
      expect(gainSb).toBeLessThanOrEqual(0);
    } else {
      expect(gainSb).toBeGreaterThan(0);
      expect(gainBb).toBeGreaterThan(0);
    }
  });

  it('B. 6-max — folds leave one winner; fold terminal resolves without evaluator inspection', () => {
    const players = Array.from({ length: 6 }, (_, i) => ({
      playerId: `p${i}`,
      seatIndex: i as SeatIndex,
      startingChips: 900,
    }));

    const base = createInitialGameState({
      table: {
        tableId: 'b',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players,
    });

    let g = startHand(tablePatch(base, { dealerSeatIndex: 0 }), {
      rng: rng('B'),
    });

    const wealthStart = getTotalWealth(g);

    let guard = 0;
    while (
      g.hand &&
      !g.hand.isComplete &&
      getContestantSeatIndexes(g).length > 1 &&
      guard++ < 200
    ) {
      const seat = g.table.activeSeatIndex;
      if (seat == null) {
        if (canAdvanceStreet(g)) g = advanceStreet(g);
        continue;
      }
      g = applyAction(g, seat, { kind: 'fold' });
    }

    while (canAdvanceStreet(g)) {
      g = advanceStreet(g);
    }

    expect(g.hand?.isComplete).toBe(true);

    const survivor =
      getContestantSeatIndexes(g).length === 1
        ? getContestantSeatIndexes(g)[0]!
        : null;
    expect(survivor).not.toBeNull();

    const resolved = resolveShowdown(g);
    assertChipConservation(g, resolved);
    expect(getTotalWealth(resolved)).toBe(wealthStart);

    const pid = getPlayerAtSeat(resolved, survivor!)!.playerId;
    expect(resolved.playersById[pid]!.chips).toBeGreaterThan(
      g.playersById[pid]!.chips,
    );
  });

  it('C. flop / turn / river progression — board 3 → 4 → 5', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'c',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'x', seatIndex: 1, startingChips: 900 },
        { playerId: 'y', seatIndex: 4, startingChips: 900 },
      ],
    });

    let g = startHand(tablePatch(base, { dealerSeatIndex: 3 }), {
      rng: rng('C'),
    });

    g = progressPassiveBettingRound(g);
    expect(isBettingRoundComplete(g)).toBe(true);
    g = advanceStreet(g);
    expect(g.hand?.boardCards.length).toBe(3);

    g = progressPassiveBettingRound(g);
    g = advanceStreet(g);
    expect(g.hand?.boardCards.length).toBe(4);

    g = progressPassiveBettingRound(g);
    g = advanceStreet(g);
    expect(g.hand?.boardCards.length).toBe(5);

    g = progressPassiveBettingRound(g);
    g = advanceStreet(g);
    expect(g.hand?.showdownReady).toBe(true);
  });

  it('D. all-in runout — board dealt to river; showdown resolves', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'd',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 's', seatIndex: 0, startingChips: 120 },
        { playerId: 'b', seatIndex: 3, startingChips: 120 },
      ],
    });

    let g = startHand(tablePatch(base, { dealerSeatIndex: 0 }), {
      rng: rng('D'),
    });

    const wealthStart = getTotalWealth(g);

    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;

    g = applyAction(g, sbSeat, { kind: 'allin' });
    g = applyAction(g, bbSeat, { kind: 'call' });

    expect(canAdvanceStreet(g)).toBe(true);
    g = advanceStreet(g);

    expect(g.hand?.showdownReady).toBe(true);
    expect(g.hand?.boardCards.length).toBe(5);

    const resolved = resolveShowdown(g);
    assertChipConservation(g, resolved);
    expect(getTotalWealth(resolved)).toBe(wealthStart);
  });

  it('E. side-pot showdown — UTG short all-in, SB reshoves, BB calls', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'e',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'utg', seatIndex: 1, startingChips: 50 },
        { playerId: 'sb', seatIndex: 3, startingChips: 200 },
        { playerId: 'bb', seatIndex: 5, startingChips: 200 },
      ],
    });

    let g = startHand(tablePatch(base, { dealerSeatIndex: 5 }), {
      rng: rng('E'),
    });

    const wealthStart = getTotalWealth(g);

    const utgSeat = g.table.activeSeatIndex!;
    expect(getPlayerAtSeat(g, utgSeat)!.playerId).toBe('utg');

    g = applyAction(g, utgSeat, { kind: 'allin' });

    const sbSeat = g.table.activeSeatIndex!;
    expect(getPlayerAtSeat(g, sbSeat)!.playerId).toBe('sb');
    g = applyAction(g, sbSeat, { kind: 'allin' });

    const bbSeat = g.table.activeSeatIndex!;
    expect(getPlayerAtSeat(g, bbSeat)!.playerId).toBe('bb');
    g = applyAction(g, bbSeat, { kind: 'call' });

    expect(isBettingRoundComplete(g)).toBe(true);
    expect(canAdvanceStreet(g)).toBe(true);
    g = advanceStreet(g);
    expect(g.hand?.showdownReady).toBe(true);

    const sd = determineShowdownWinners(g);
    expect(sd.potResults.length).toBeGreaterThanOrEqual(2);

    const resolved = resolveShowdown(g);
    assertChipConservation(g, resolved);
    expect(getTotalWealth(resolved)).toBe(wealthStart);
  });

  it('F1. odd-chip recipient moves when dealer moves (rule contract)', () => {
    expect(getOddChipWinner([1, 4], 0, 6)).toBe(1);
    expect(getOddChipWinner([1, 4], 3, 6)).toBe(4);
  });

  it('F2. HU tied showdown — chop splits pot and conserves wealth', () => {
    let found = false;
    for (let i = 0; i < 900; i++) {
      const base = createInitialGameState({
        table: {
          tableId: 'f2',
          maxSeats: 6,
          smallBlind: 5,
          bigBlind: 10,
        },
        players: [
          { playerId: 'u', seatIndex: 0, startingChips: 900 },
          { playerId: 'v', seatIndex: 3, startingChips: 900 },
        ],
      });

      let g = startHand(tablePatch(base, { dealerSeatIndex: i % 6 }), {
        rng: rng(`F2-${i}`),
      });

      const w0 = getTotalWealth(g);
      g = runPassiveShowdown(g);
      if (!g.hand?.showdownReady) continue;

      const sbSeat = g.table.smallBlindSeatIndex;
      const bbSeat = g.table.bigBlindSeatIndex;
      const board = g.hand.boardCards;

      const evA = evaluateBestHand([
        ...getPlayerAtSeat(g, sbSeat)!.holeCards,
        ...board,
      ]);
      const evB = evaluateBestHand([
        ...getPlayerAtSeat(g, bbSeat)!.holeCards,
        ...board,
      ]);

      if (compareEvaluatedHands(evA, evB) !== 0) continue;

      const sd = determineShowdownWinners(g);
      expect(sd.potResults[0]!.winningSeatIndexes.length).toBe(2);

      const resolved = resolveShowdown(g);
      assertChipConservation(g, resolved);
      expect(getTotalWealth(resolved)).toBe(w0);

      found = true;
      break;
    }

    expect(found).toBe(true);
  });

  it('G. board chop tie — seed search finds chopped eligible winners', () => {
    let ok = false;
    for (let i = 0; i < 280; i++) {
      const base = createInitialGameState({
        table: {
          tableId: 'g',
          maxSeats: 6,
          smallBlind: 5,
          bigBlind: 10,
        },
        players: [
          { playerId: 'u', seatIndex: 2, startingChips: 900 },
          { playerId: 'v', seatIndex: 5, startingChips: 900 },
        ],
      });

      let g = startHand(tablePatch(base, { dealerSeatIndex: 1 }), {
        rng: rng(`G-${i}`),
      });

      g = runPassiveShowdown(g);
      if (!g.hand?.showdownReady) continue;

      const sbSeat = g.table.smallBlindSeatIndex;
      const bbSeat = g.table.bigBlindSeatIndex;

      const evSb = evaluateBestHand([
        ...getPlayerAtSeat(g, sbSeat)!.holeCards,
        ...g.hand.boardCards,
      ]);
      const evBb = evaluateBestHand([
        ...getPlayerAtSeat(g, bbSeat)!.holeCards,
        ...g.hand.boardCards,
      ]);

      if (compareEvaluatedHands(evSb, evBb) !== 0) continue;

      const sd = determineShowdownWinners(g);
      if (sd.potResults[0]!.winningSeatIndexes.length >= 2) {
        ok = true;
        break;
      }
    }

    expect(ok).toBe(true);
  });
});
