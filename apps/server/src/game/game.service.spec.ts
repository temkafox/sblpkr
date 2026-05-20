import { describe, expect, it } from 'vitest';

import type { CoreGameState, SeatIndex } from '@neonpoker/poker-core';
import {
  createSeededRandom,
  getAvailableActions,
  getPlayerAtSeat,
  isBettingRoundComplete,
} from '@neonpoker/poker-core';
import type { PlayerActionIntent } from '@neonpoker/shared';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from './game.constants';
import { GameOrchestrationError } from './game.errors';
import { GameService } from './game.service';

function getTotalWealth(state: CoreGameState): number {
  let sum = 0;
  for (const pid of Object.keys(state.playersById)) {
    const p = state.playersById[pid]!;
    sum += p.chips + p.totalCommitted;
  }
  return sum;
}

function testRoomService(): RoomService {
  let seq = 0;
  return RoomService.forTest({
    code: () => {
      seq += 1;
      return `G${String(seq).padStart(5, '0')}`.slice(0, 6);
    },
    id: () => {
      const suffix = String(seq).padStart(12, '0');
      return `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`;
    },
  });
}

function seatRoom(
  roomService: RoomService,
  playerCount: number,
  maxSeats: 2 | 4 | 6 | 9 = 6,
): string {
  const room = roomService.createRoom({ maxSeats });
  for (let i = 0; i < playerCount; i++) {
    const sid = `sock-${i}`;
    roomService.registerNickname(sid, { nickname: `Player_${i}` });
    roomService.joinRoom(sid, { roomId: room.roomId });
  }
  return room.roomId;
}

function gameHarness(seed: string): {
  readonly roomService: RoomService;
  readonly tableService: TableService;
  readonly game: GameService;
} {
  const roomService = testRoomService();
  const tableService = new TableService();
  const game = GameService.forTest({
    roomService,
    tableService,
    rng: () => createSeededRandom(seed),
  });
  return { roomService, tableService, game };
}

function activeSeat(state: CoreGameState): SeatIndex {
  const seat = state.table.activeSeatIndex;
  if (seat == null) {
    throw new Error('No active seat');
  }
  return seat;
}

function act(
  game: GameService,
  roomId: string,
  action: PlayerActionIntent,
  seat?: SeatIndex,
): CoreGameState {
  const state = game.getGameState(roomId);
  const seatIndex = seat ?? activeSeat(state);
  return game.applyPlayerAction(roomId, seatIndex, action);
}

type StreetName = 'PRE-FLOP' | 'FLOP' | 'TURN' | 'RIVER';

/** Check/call through the current street only (orchestration may advance one chapter after close). */

function closeBettingOnStreet(
  game: GameService,
  roomId: string,
  street: StreetName,
): CoreGameState {
  let state = game.getGameState(roomId);
  let guard = 0;

  while (
    state.hand?.street === street &&
    !isBettingRoundComplete(state) &&
    guard++ < 80
  ) {
    const seat = activeSeat(state);
    const available = getAvailableActions(state, seat);
    if (available.canCheck) {
      state = game.applyPlayerAction(roomId, seat, { kind: 'check' });
    } else if (available.canCall) {
      state = game.applyPlayerAction(roomId, seat, { kind: 'call' });
    } else {
      break;
    }
  }

  return game.getGameState(roomId);
}

describe('GameService (Phase 6C1)', () => {
  it('cannot start hand with fewer than 2 players', () => {
    const { roomService, game } = gameHarness('6c1-lonely');
    const roomId = seatRoom(roomService, 1);

    expect(() => game.startHand(roomId)).toThrow(GameOrchestrationError);
    try {
      game.startHand(roomId);
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('NOT_ENOUGH_PLAYERS');
    }
  });

  it('starts hand for 2 players and posts blinds', () => {
    const { roomService, game } = gameHarness('6c1-hu-start');
    const roomId = seatRoom(roomService, 2, 6);

    const started = game.startHand(roomId);

    expect(started.hand).not.toBeNull();
    expect(started.hand!.street).toBe('PRE-FLOP');
    expect(started.table.smallBlindSeatIndex).not.toBeNull();
    expect(started.table.bigBlindSeatIndex).not.toBeNull();

    const sb = getPlayerAtSeat(started, started.table.smallBlindSeatIndex!)!;
    const bb = getPlayerAtSeat(started, started.table.bigBlindSeatIndex!)!;

    expect(sb.currentBet).toBe(DEFAULT_SMALL_BLIND);
    expect(bb.currentBet).toBe(DEFAULT_BIG_BLIND);
    expect(sb.chips).toBe(DEFAULT_STARTING_CHIPS - DEFAULT_SMALL_BLIND);
    expect(bb.chips).toBe(DEFAULT_STARTING_CHIPS - DEFAULT_BIG_BLIND);
  });

  it('starts hand for 6 players', () => {
    const { roomService, game } = gameHarness('6c1-six-max');
    const roomId = seatRoom(roomService, 6, 6);

    const started = game.startHand(roomId);

    expect(Object.keys(started.playersById)).toHaveLength(6);
    expect(started.hand?.street).toBe('PRE-FLOP');
  });

  it('assigns seats from room join order', () => {
    const { roomService, game } = gameHarness('6c1-seats');
    const roomId = seatRoom(roomService, 3, 6);

    const room = roomService.getRoom(roomId)!;
    const started = game.startHand(roomId);

    for (let i = 0; i < room.players.length; i++) {
      const rosterId = room.players[i]!.playerId;
      const core = started.playersById[rosterId];
      expect(core?.seatIndex).toBe(i);
    }
  });

  it('applies fold action', () => {
    const { roomService, game } = gameHarness('6c1-fold');
    const roomId = seatRoom(roomService, 2, 6);

    game.startHand(roomId);
    const afterFold = act(game, roomId, { kind: 'fold' });

    expect(
      Object.values(afterFold.playersById).some((p) => p.hasFolded),
    ).toBe(true);
  });

  it('applies call and check flow', () => {
    const { roomService, game } = gameHarness('6c1-call-check');
    const roomId = seatRoom(roomService, 2, 6);

    game.startHand(roomId);
    const toCall = act(game, roomId, { kind: 'call' });
    expect(toCall.hand?.street).toBe('PRE-FLOP');

    const closed = closeBettingOnStreet(game, roomId, 'PRE-FLOP');
    expect(closed.hand?.street).toBe('FLOP');
    expect(closed.hand?.boardCards.length).toBe(3);
  });

  it('advances from preflop to flop after betting round completes', () => {
    const { roomService, game } = gameHarness('6c1-preflop-flop');
    const roomId = seatRoom(roomService, 2, 6);

    game.startHand(roomId);
    const state = closeBettingOnStreet(game, roomId, 'PRE-FLOP');

    expect(state.hand?.street).toBe('FLOP');
    expect(state.hand?.boardCards.length).toBe(3);
  });

  it('advances through turn, river, and showdown via orchestration', () => {
    const { roomService, game } = gameHarness('6c1-runout');
    const roomId = seatRoom(roomService, 2, 6);

    game.startHand(roomId);

    let state = game.getGameState(roomId);
    const wealthStart = getTotalWealth(state);

    state = closeBettingOnStreet(game, roomId, 'PRE-FLOP');
    expect(state.hand?.street).toBe('FLOP');

    state = closeBettingOnStreet(game, roomId, 'FLOP');
    expect(state.hand?.street).toBe('TURN');

    state = closeBettingOnStreet(game, roomId, 'TURN');
    expect(state.hand?.street).toBe('RIVER');

    state = closeBettingOnStreet(game, roomId, 'RIVER');
    expect(state.hand?.street).toBe('SHOWDOWN');
    expect(state.hand?.showdownReady).toBe(true);

    state = game.progressAfterAction(state);
    expect(state.hand?.isComplete).toBe(true);
    expect(state.hand?.showdownReady).toBe(true);
    expect(getTotalWealth(state)).toBe(wealthStart);
  });

  it('resolves fold-win and conserves chips', () => {
    const { roomService, game } = gameHarness('6c1-fold-win');
    const roomId = seatRoom(roomService, 2, 6);

    let state = game.startHand(roomId);
    const wealthStart = getTotalWealth(state);

    const folderSeat = activeSeat(state);
    state = game.applyPlayerAction(roomId, folderSeat, { kind: 'fold' });

    expect(state.hand?.isComplete).toBe(true);
    expect(state.hand?.showdownReady).toBe(true);

    const winner = Object.values(state.playersById).find((p) => !p.hasFolded);
    expect(winner!.chips).toBeGreaterThan(DEFAULT_STARTING_CHIPS);
    expect(getTotalWealth(state)).toBe(wealthStart);
  });

  it('resolves a simple showdown with chip conservation', () => {
    const { roomService, game } = gameHarness('6c1-showdown');
    const roomId = seatRoom(roomService, 2, 6);

    game.startHand(roomId);
    let state = game.getGameState(roomId);
    const wealthStart = getTotalWealth(state);

    for (const street of ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'] as const) {
      state = closeBettingOnStreet(game, roomId, street);
      if (state.hand?.showdownReady) break;
    }
    if (state.hand?.showdownReady) {
      state = game.progressAfterAction(state);
    }

    expect(state.hand?.isComplete).toBe(true);
    expect(state.hand?.boardCards.length).toBe(5);
    expect(getTotalWealth(state)).toBe(wealthStart);
  });

  it('getGameState throws when table is missing', () => {
    const { game } = gameHarness('6c1-missing');
    try {
      game.getGameState('missing-room');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('TABLE_NOT_FOUND');
    }
  });

  it('applyPlayerAction throws without an active hand', () => {
    const { roomService, tableService, game } = gameHarness('6c1-no-hand');
    const roomId = seatRoom(roomService, 2, 6);
    tableService.createTableForRoom(roomService.getRoom(roomId)!);

    try {
      game.applyPlayerAction(roomId, 0, { kind: 'check' });
      expect.fail('expected throw');
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('NO_ACTIVE_HAND');
    }
  });
});
