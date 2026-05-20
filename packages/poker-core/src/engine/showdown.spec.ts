import { describe, expect, it } from 'vitest';

import type { Card } from '@neonpoker/shared';

import type { CoreGameState } from '../domain/game-state';
import type { HandState } from '../domain/hand-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import { createInitialGameState } from '../domain/game-state';

import { DuplicateCardError, ShowdownNotReadyError } from './errors';
import { evaluateBestHand, HandCategory } from './hand-evaluator';
import {
  determineShowdownWinners,
  distributePots,
  resolveFoldWin,
  resolveShowdown,
} from './showdown';

const C = (r: Card['r'], s: Card['s']): Card => Object.freeze({ r, s });

function totalPlayerWealth(state: CoreGameState): number {
  let sum = 0;
  for (const id of Object.keys(state.playersById)) {
    const p = state.playersById[id]!;
    sum += p.chips + p.totalCommitted;
  }
  return sum;
}

function makeHand(base: Partial<HandState> & { handId: string; street: HandState['street'] }): HandState {
  const pots = base.pots ?? Object.freeze({ total: 0, sidePots: Object.freeze([]) });
  return Object.freeze({
    deck: Object.freeze([]),
    boardCards: Object.freeze([]),
    currentBet: 0,
    minRaise: 10,
    lastRaiseAmount: 10,
    lastAggressorSeatIndex: null,
    actedSeatIndexes: Object.freeze([]),
    raiseFrozenSeatIndexes: Object.freeze([]),
    showdownReady: false,
    isComplete: false,
    ...base,
    pots,
    lastPublicActionsBySeat: base.lastPublicActionsBySeat ?? Object.freeze({}),
  });
}

type PlayerRow = {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly startingChips: number;
  readonly totalCommitted: number;
  readonly holeCards: readonly Card[];
  readonly hasFolded?: boolean;
};

function buildShowdownGame(opts: {
  readonly dealerSeatIndex: number;
  readonly smallBlindSeatIndex?: number;
  readonly bigBlindSeatIndex?: number;
  readonly board?: readonly Card[];
  readonly players: readonly PlayerRow[];
  readonly hand?: Partial<HandState>;
}): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'sd',
      maxSeats: 9,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: opts.players.map((p) => ({
      playerId: p.playerId,
      seatIndex: p.seatIndex,
      startingChips: p.startingChips,
    })),
  });

  const playersById: Record<string, PlayerRuntimeState> = Object.create(null);
  for (const r of opts.players) {
    const starter = base.playersById[r.playerId]!;
    playersById[r.playerId] = Object.freeze({
      ...starter,
      chips: starter.chips - r.totalCommitted,
      totalCommitted: r.totalCommitted,
      currentBet: 0,
      holeCards: Object.freeze([...r.holeCards]),
      hasFolded: r.hasFolded ?? false,
    });
  }

  const patch = opts.hand ?? {};
  const boardCards =
    patch.boardCards ??
    Object.freeze([...(opts.board ?? [])]);

  const hand: HandState = makeHand({
    ...patch,
    handId: patch.handId ?? 'hand-1',
    street: patch.street ?? 'SHOWDOWN',
    deck: patch.deck ?? Object.freeze([]),
    boardCards,
    pots:
      patch.pots ??
      Object.freeze({ total: 0, sidePots: Object.freeze([]) }),
    currentBet: patch.currentBet ?? 0,
    minRaise: patch.minRaise ?? 10,
    lastRaiseAmount: patch.lastRaiseAmount ?? 10,
    lastAggressorSeatIndex:
      patch.lastAggressorSeatIndex !== undefined
        ? patch.lastAggressorSeatIndex
        : null,
    actedSeatIndexes: patch.actedSeatIndexes ?? Object.freeze([]),
    raiseFrozenSeatIndexes:
      patch.raiseFrozenSeatIndexes ?? Object.freeze([]),
    showdownReady: patch.showdownReady ?? true,
    isComplete: patch.isComplete ?? false,
  });

  return Object.freeze({
    ...base,
    playersById: Object.freeze(playersById),
    hand,
    table: Object.freeze({
      ...base.table,
      dealerSeatIndex: opts.dealerSeatIndex,
      smallBlindSeatIndex: opts.smallBlindSeatIndex ?? opts.dealerSeatIndex,
      bigBlindSeatIndex: opts.bigBlindSeatIndex ?? opts.dealerSeatIndex,
      activeSeatIndex: null,
    }),
  });
}

/** Board plays for both — nine-high straight on board, low kickers irrelevant. */

function boardChopGame(dealer = 0): CoreGameState {
  const board = [
    C('9', 's'),
    C('8', 'h'),
    C('7', 'd'),
    C('6', 'c'),
    C('5', 's'),
  ];
  return buildShowdownGame({
    dealerSeatIndex: dealer,
    board,
    players: [
      {
        playerId: 'a',
        seatIndex: 1,
        startingChips: 5000,
        totalCommitted: 60,
        holeCards: [C('2', 'c'), C('3', 'd')],
      },
      {
        playerId: 'b',
        seatIndex: 3,
        startingChips: 5000,
        totalCommitted: 60,
        holeCards: [C('4', 'h'), C('2', 'd')],
      },
    ],
  });
}

describe('determineShowdownWinners', () => {
  it('awards whole pot to a single best hand', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      board: [
        C('8', 's'),
        C('8', 'h'),
        C('8', 'd'),
        C('2', 'c'),
        C('3', 's'),
      ],
      players: [
        {
          playerId: 'p',
          seatIndex: 1,
          startingChips: 4000,
          totalCommitted: 100,
          holeCards: [C('A', 's'), C('A', 'c')],
        },
        {
          playerId: 'q',
          seatIndex: 3,
          startingChips: 4000,
          totalCommitted: 100,
          holeCards: [C('K', 's'), C('K', 'c')],
        },
      ],
    });

    const r = determineShowdownWinners(g);

    expect(r.potResults).toHaveLength(1);
    expect(r.potResults[0]!.winningSeatIndexes).toEqual([1]);
    expect(r.potResults[0]!.winningHand?.category).toBe(HandCategory.FullHouse);
    expect(r.winners).toEqual([1]);
  });

  it('splits evenly when tied on the same board-nut hand', () => {
    const g = boardChopGame(0);
    const r = determineShowdownWinners(g);
    expect(r.potResults[0]!.winningSeatIndexes.slice().sort()).toEqual([1, 3]);
    const awards = r.potResults[0]!.awardedAmountsBySeatIndex;
    expect((awards[1] ?? 0) + (awards[3] ?? 0)).toBe(r.potResults[0]!.amount);
    expect(awards[1]).toBe(awards[3]);
  });

  it('applies odd-chip rule on a tied side pot with an odd chip count', () => {
    const board = [
      C('9', 's'),
      C('8', 'h'),
      C('7', 'd'),
      C('6', 'c'),
      C('5', 's'),
    ];
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      board,
      players: [
        {
          playerId: 'a',
          seatIndex: 1,
          startingChips: 8000,
          totalCommitted: 50,
          holeCards: [C('2', 'c'), C('3', 'd')],
        },
        {
          playerId: 'b',
          seatIndex: 3,
          startingChips: 8000,
          totalCommitted: 50,
          holeCards: [C('4', 'h'), C('2', 'h')],
        },
        {
          playerId: 'dead',
          seatIndex: 5,
          startingChips: 8000,
          totalCommitted: 1,
          hasFolded: true,
          holeCards: [],
        },
      ],
    });

    const r = determineShowdownWinners(g);
    const tiny = r.potResults.find((p) => p.amount === 3);
    expect(tiny).toBeDefined();
    expect(tiny!.winningSeatIndexes.slice().sort()).toEqual([1, 3]);
    const awards = tiny!.awardedAmountsBySeatIndex;
    expect((awards[1] ?? 0) + (awards[3] ?? 0)).toBe(3);
    expect(Math.abs((awards[1] ?? 0) - (awards[3] ?? 0))).toBe(1);
    expect(awards[1]).toBeGreaterThan(awards[3] ?? 0);
  });

  it('odd-chip ordering follows dealer position for the same tied pot', () => {
    const board = [
      C('9', 's'),
      C('8', 'h'),
      C('7', 'd'),
      C('6', 'c'),
      C('5', 's'),
    ];
    const mk = (dealer: number) =>
      buildShowdownGame({
        dealerSeatIndex: dealer,
        board,
        players: [
          {
            playerId: 'a',
            seatIndex: 1,
            startingChips: 8000,
            totalCommitted: 50,
            holeCards: [C('2', 'c'), C('3', 'd')],
          },
          {
            playerId: 'b',
            seatIndex: 3,
            startingChips: 8000,
            totalCommitted: 50,
            holeCards: [C('4', 'h'), C('2', 'h')],
          },
          {
            playerId: 'dead',
            seatIndex: 5,
            startingChips: 8000,
            totalCommitted: 1,
            hasFolded: true,
            holeCards: [],
          },
        ],
      });

    const ra = determineShowdownWinners(mk(0));
    const rb = determineShowdownWinners(mk(2));
    const ta = ra.potResults.find((p) => p.amount === 3)!;
    const tb = rb.potResults.find((p) => p.amount === 3)!;

    expect(ta.awardedAmountsBySeatIndex[1]).not.toBe(tb.awardedAmountsBySeatIndex[1]);
  });

  it('main vs side pot can pick different winners', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      board: [
        C('8', 's'),
        C('8', 'h'),
        C('8', 'd'),
        C('2', 'c'),
        C('3', 's'),
      ],
      players: [
        {
          playerId: 'short',
          seatIndex: 1,
          startingChips: 9000,
          totalCommitted: 40,
          holeCards: [C('A', 's'), C('A', 'c')],
        },
        {
          playerId: 'mid',
          seatIndex: 3,
          startingChips: 9000,
          totalCommitted: 80,
          holeCards: [C('K', 's'), C('K', 'h')],
        },
        {
          playerId: 'deep',
          seatIndex: 5,
          startingChips: 9000,
          totalCommitted: 200,
          holeCards: [C('Q', 'd'), C('Q', 'c')],
        },
      ],
    });

    const r = determineShowdownWinners(g);

    expect(r.potResults.length).toBeGreaterThanOrEqual(2);
    expect(r.potResults[0]!.winningSeatIndexes).toEqual([1]);
    expect(r.potResults[1]!.winningSeatIndexes).toEqual([3]);
  });

  it('excludes folded players even with strong private cards', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      board: [
        C('2', 's'),
        C('3', 'h'),
        C('4', 'd'),
        C('7', 'c'),
        C('9', 's'),
      ],
      players: [
        {
          playerId: 'folder',
          seatIndex: 1,
          startingChips: 4000,
          totalCommitted: 80,
          holeCards: [C('A', 's'), C('A', 'h')],
          hasFolded: true,
        },
        {
          playerId: 'live',
          seatIndex: 4,
          startingChips: 4000,
          totalCommitted: 80,
          holeCards: [C('K', 's'), C('Q', 'h')],
        },
        {
          playerId: 'live2',
          seatIndex: 6,
          startingChips: 4000,
          totalCommitted: 80,
          holeCards: [C('6', 'c'), C('5', 'd')],
        },
      ],
    });

    const r = determineShowdownWinners(g);
    expect(r.potResults[0]!.eligibleSeatIndexes).not.toContain(1);
    expect(r.potResults[0]!.winningSeatIndexes).not.toContain(1);
    expect(
      r.potResults[0]!.winningSeatIndexes.every((s) => s === 4 || s === 6),
    ).toBe(true);
  });
});

describe('resolveShowdown / distributePots', () => {
  it('preserves chip wealth (contested + uncalled) across resolution', () => {
    let g = buildShowdownGame({
      dealerSeatIndex: 0,
      board: [
        C('K', 's'),
        C('Q', 'h'),
        C('J', 'd'),
        C('10', 'c'),
        C('9', 's'),
      ],
      players: [
        {
          playerId: 'w',
          seatIndex: 1,
          startingChips: 10_000,
          totalCommitted: 100,
          holeCards: [C('A', 's'), C('K', 'c')],
        },
        {
          playerId: 'l',
          seatIndex: 3,
          startingChips: 10_000,
          totalCommitted: 100,
          holeCards: [C('8', 'h'), C('7', 'h')],
        },
      ],
    });

    const w0 = totalPlayerWealth(g);
    g = resolveShowdown(g);
    expect(totalPlayerWealth(g)).toBe(w0);
    expect(g.hand?.isComplete).toBe(true);
    expect(g.hand?.showdownReady).toBe(true);
    expect(g.table.activeSeatIndex).toBeNull();
    for (const id of Object.keys(g.playersById)) {
      expect(g.playersById[id]!.totalCommitted).toBe(0);
    }
  });

  it('does not mutate the input snapshot', () => {
    const g = boardChopGame(0);
    const snapPlayers = JSON.stringify(g.playersById);
    const snapHand = JSON.stringify(g.hand);
    distributePots(g);
    expect(JSON.stringify(g.playersById)).toBe(snapPlayers);
    expect(JSON.stringify(g.hand)).toBe(snapHand);
  });

  it('throws when showdown is not terminal', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      players: [
        {
          playerId: 'a',
          seatIndex: 0,
          startingChips: 1000,
          totalCommitted: 20,
          holeCards: [C('2', 'c'), C('3', 'c')],
        },
        {
          playerId: 'b',
          seatIndex: 1,
          startingChips: 1000,
          totalCommitted: 20,
          holeCards: [C('4', 'd'), C('5', 'd')],
        },
      ],
      hand: {
        street: 'PRE-FLOP',
        showdownReady: false,
        isComplete: false,
        boardCards: Object.freeze([]),
      },
    });

    expect(() => resolveShowdown(g)).toThrow(ShowdownNotReadyError);
  });

  it('determineShowdownWinners rejects fewer than five board cards', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      players: [
        {
          playerId: 'a',
          seatIndex: 0,
          startingChips: 1000,
          totalCommitted: 20,
          holeCards: [C('2', 'c'), C('3', 'c')],
        },
        {
          playerId: 'b',
          seatIndex: 1,
          startingChips: 1000,
          totalCommitted: 20,
          holeCards: [C('4', 'd'), C('5', 'd')],
        },
      ],
      hand: {
        street: 'SHOWDOWN',
        showdownReady: true,
        boardCards: Object.freeze([
          C('A', 's'),
          C('K', 's'),
          C('Q', 's'),
          C('J', 's'),
        ]),
      },
    });

    expect(() => determineShowdownWinners(g)).toThrow(ShowdownNotReadyError);
  });

  it('rejects duplicate cards between hole and board', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      board: [
        C('K', 's'),
        C('Q', 'h'),
        C('J', 'd'),
        C('10', 'c'),
        C('9', 's'),
      ],
      players: [
        {
          playerId: 'a',
          seatIndex: 0,
          startingChips: 1000,
          totalCommitted: 20,
          holeCards: [C('K', 's'), C('A', 'h')],
        },
        {
          playerId: 'b',
          seatIndex: 1,
          startingChips: 1000,
          totalCommitted: 20,
          holeCards: [C('2', 'c'), C('3', 'c')],
        },
      ],
    });

    expect(() => determineShowdownWinners(g)).toThrow(DuplicateCardError);
  });
});

describe('resolveFoldWin', () => {
  it('awards pots to the only non-folded player without evaluation', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 2,
      board: [],
      players: [
        {
          playerId: 'hero',
          seatIndex: 2,
          startingChips: 5000,
          totalCommitted: 150,
          holeCards: [],
        },
        {
          playerId: 'f',
          seatIndex: 5,
          startingChips: 5000,
          totalCommitted: 50,
          hasFolded: true,
          holeCards: [],
        },
      ],
      hand: {
        street: 'PRE-FLOP',
        showdownReady: false,
        isComplete: true,
        boardCards: Object.freeze([]),
      },
    });

    const w0 = totalPlayerWealth(g);
    const next = resolveFoldWin(g);
    expect(totalPlayerWealth(next)).toBe(w0);
    expect(next.playersById['hero']!.chips).toBeGreaterThan(
      g.playersById['hero']!.chips,
    );
    expect(next.hand?.showdownReady).toBe(true);
    expect(next.hand?.isComplete).toBe(true);
  });
});

describe('returnableUncalled fold-win integration', () => {
  it('returns uncalled chips to the entitled seat, not via pot', () => {
    let g = createInitialGameState({
      table: {
        tableId: 'hu',
        maxSeats: 4,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'folder', seatIndex: 1, startingChips: 10_000 },
        { playerId: 'hero', seatIndex: 3, startingChips: 10_000 },
      ],
    });

    const playersById: Record<string, PlayerRuntimeState> = Object.create(
      null,
    );
    for (const pid of Object.keys(g.playersById)) {
      const starter = g.playersById[pid]!;
      if (pid === 'folder') {
        playersById[pid] = Object.freeze({
          ...starter,
          chips: starter.chips - 50,
          totalCommitted: 50,
          hasFolded: true,
          holeCards: Object.freeze([]),
        });
      } else {
        playersById[pid] = Object.freeze({
          ...starter,
          chips: starter.chips - 150,
          totalCommitted: 150,
          holeCards: Object.freeze([]),
        });
      }
    }

    const hand = makeHand({
      handId: 'h2',
      street: 'PRE-FLOP',
      deck: Object.freeze([]),
      boardCards: Object.freeze([]),
      currentBet: 0,
      minRaise: 10,
      lastRaiseAmount: 10,
      lastAggressorSeatIndex: null,
      actedSeatIndexes: Object.freeze([]),
      lastPublicActionsBySeat: Object.freeze({}),
      raiseFrozenSeatIndexes: Object.freeze([]),
      showdownReady: false,
      isComplete: true,
    });

    g = Object.freeze({
      ...g,
      playersById: Object.freeze(playersById),
      hand,
      table: Object.freeze({
        ...g.table,
        dealerSeatIndex: 0,
        activeSeatIndex: null,
      }),
    });

    const w0 = totalPlayerWealth(g);
    const next = resolveShowdown(g);
    expect(totalPlayerWealth(next)).toBe(w0);
    expect(next.playersById['hero']!.chips).toBe(
      g.playersById['hero']!.chips + 100 + 100,
    );
  });
});

describe('showdown — aces and fours vs pair of fours (split-pot bug)', () => {
  const board = Object.freeze([
    C('A', 's'),
    C('4', 'c'),
    C('4', 's'),
    C('J', 'c'),
    C('3', 'd'),
  ]);

  it('c32c wins the full $800 pot — not a split', () => {
    const g = buildShowdownGame({
      dealerSeatIndex: 0,
      board,
      players: [
        {
          playerId: 'asd',
          seatIndex: 0,
          startingChips: 800,
          totalCommitted: 400,
          holeCards: [C('9', 'c'), C('6', 'd')],
        },
        {
          playerId: 'c32c',
          seatIndex: 1,
          startingChips: 800,
          totalCommitted: 400,
          holeCards: [C('A', 'c'), C('10', 's')],
        },
      ],
      hand: {
        street: 'SHOWDOWN',
        showdownReady: true,
        pots: Object.freeze({ total: 800, sidePots: Object.freeze([]) }),
      },
    });

    const result = determineShowdownWinners(g);
    expect(result.winners).toEqual([1]);
    expect(result.potResults).toHaveLength(1);
    expect(result.potResults[0]!.awardedAmountsBySeatIndex[1]).toBe(800);
    expect(result.potResults[0]!.awardedAmountsBySeatIndex[0] ?? 0).toBe(0);
    expect(result.evaluatedHandsBySeatIndex[1]?.category).toBe(
      HandCategory.TwoPair,
    );
    expect(result.evaluatedHandsBySeatIndex[0]?.category).toBe(
      HandCategory.OnePair,
    );
  });

  it('does not treat board-only hands as a tie when hole cards improve', () => {
    const asdOnlyBoard = evaluateBestHand([...board]);
    const c32cSeven = evaluateBestHand([
      C('A', 'c'),
      C('10', 's'),
      ...board,
    ]);
    expect(asdOnlyBoard.category).toBe(HandCategory.OnePair);
    expect(c32cSeven.category).toBe(HandCategory.TwoPair);
  });
});
