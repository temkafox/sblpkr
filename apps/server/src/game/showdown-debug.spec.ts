import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@neonpoker/shared';
import { DEFAULT_ROOM_SETTINGS } from '@neonpoker/shared';
import {
  determineShowdownWinners,
  createInitialGameState,
} from '@neonpoker/poker-core';
import type { CoreGameState, HandState, PlayerRuntimeState } from '@neonpoker/poker-core';

import {
  __setDebugShowdownEnvForTests,
  isShowdownDebugEnabled,
} from './showdown-debug-config';
import { logShowdownResolution } from './showdown-debug';

const C = (r: Card['r'], s: Card['s']): Card => Object.freeze({ r, s });

function sampleShowdownState(): {
  state: CoreGameState;
  result: ReturnType<typeof determineShowdownWinners>;
} {
  const board = Object.freeze([
    C('A', 's'),
    C('4', 'c'),
    C('4', 's'),
    C('J', 'c'),
    C('3', 'd'),
  ]);
  const base = createInitialGameState({
    table: { tableId: 'dbg', maxSeats: 6, smallBlind: 5, bigBlind: 10 },
    players: [
      { playerId: 'p0', seatIndex: 0, startingChips: 800 },
      { playerId: 'p1', seatIndex: 1, startingChips: 800 },
    ],
  });
  const playersById: Record<string, PlayerRuntimeState> = Object.create(null);
  for (const pid of ['p0', 'p1'] as const) {
    const starter = base.playersById[pid]!;
    playersById[pid] = Object.freeze({
      ...starter,
      chips: 400,
      totalCommitted: 400,
      holeCards: Object.freeze(
        pid === 'p0'
          ? [C('9', 'c'), C('6', 'd')]
          : [C('A', 'c'), C('10', 's')],
      ),
    });
  }
  const hand: HandState = Object.freeze({
    handId: 'hand-dbg',
    participantSeatIndexes: Object.freeze([0, 1]),
    street: 'SHOWDOWN',
    deck: Object.freeze([]),
    boardCards: board,
    pots: Object.freeze({ total: 800, sidePots: Object.freeze([]) }),
    currentBet: 0,
    minRaise: 10,
    lastRaiseAmount: 10,
    lastAggressorSeatIndex: null,
    actedSeatIndexes: Object.freeze([]),
    lastPublicActionsBySeat: Object.freeze({}),
    raiseFrozenSeatIndexes: Object.freeze([]),
    showdownReady: true,
    isComplete: false,
  });
  const state = Object.freeze({
    ...base,
    playersById: Object.freeze(playersById),
    hand,
    table: Object.freeze({
      ...base.table,
      dealerSeatIndex: 0,
      activeSeatIndex: null,
    }),
  });
  return { state, result: determineShowdownWinners(state) };
}

describe('showdown-debug-config', () => {
  afterEach(() => {
    __setDebugShowdownEnvForTests(null);
  });

  it('is false when DEBUG_SHOWDOWN is unset', () => {
    __setDebugShowdownEnvForTests(undefined);
    expect(isShowdownDebugEnabled()).toBe(false);
  });

  it('is false when DEBUG_SHOWDOWN is false or 0', () => {
    __setDebugShowdownEnvForTests('false');
    expect(isShowdownDebugEnabled()).toBe(false);
    __setDebugShowdownEnvForTests('0');
    expect(isShowdownDebugEnabled()).toBe(false);
  });

  it('is true only when DEBUG_SHOWDOWN is exactly true', () => {
    __setDebugShowdownEnvForTests('true');
    expect(isShowdownDebugEnabled()).toBe(true);
    __setDebugShowdownEnvForTests('TRUE');
    expect(isShowdownDebugEnabled()).toBe(false);
  });
});

describe('logShowdownResolution', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    __setDebugShowdownEnvForTests(null);
    vi.restoreAllMocks();
  });

  it('does not log when DEBUG_SHOWDOWN is unset', () => {
    __setDebugShowdownEnvForTests(undefined);
    const { state, result } = sampleShowdownState();
    logShowdownResolution(state, result, null);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not log when DEBUG_SHOWDOWN is false', () => {
    __setDebugShowdownEnvForTests('false');
    const { state, result } = sampleShowdownState();
    logShowdownResolution(state, result, null);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs showdown summary when DEBUG_SHOWDOWN is true', () => {
    __setDebugShowdownEnvForTests('true');
    const { state, result } = sampleShowdownState();
    logShowdownResolution(state, result, {
      roomId: 'room-dbg',
      code: 'DBG01',
      createdAt: new Date(),
      maxSeats: 6,
      status: 'playing',
      hostPlayerId: 'p0',
      settings: DEFAULT_ROOM_SETTINGS,
      actionDeadlineAt: null,
      players: [
        {
          playerId: 'p0',
          nickname: 'Alpha',
          seatIndex: 0,
          clientSessionId: 's0',
          socketId: 'sock-0',
          connectionStatus: 'connected',
          rebuyCount: 0,
        },
        {
          playerId: 'p1',
          nickname: 'Beta',
          seatIndex: 1,
          clientSessionId: 's1',
          socketId: 'sock-1',
          connectionStatus: 'connected',
          rebuyCount: 0,
        },
      ],
    });

    expect(logSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
    const messages = logSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('showdown board:'))).toBe(true);
    expect(messages.some((m) => m.includes('hole='))).toBe(true);
    expect(messages.some((m) => m.includes('showdown winnerIds:'))).toBe(true);
    expect(messages.some((m) => m.includes('showdown awarded:'))).toBe(true);
    expect(messages.some((m) => m.includes('Beta=$800'))).toBe(true);
  });
});
