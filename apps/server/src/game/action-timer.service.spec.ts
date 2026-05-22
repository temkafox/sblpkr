import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSeededRandom,
  getAvailableActions,
} from '@neonpoker/poker-core';
import type { Server } from 'socket.io';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { ActionTimerService } from './action-timer.service';
import { GameBroadcastService } from './game-broadcast';
import { GameService } from './game.service';
import { HandHistoryService } from './hand-history.service';
import { NextHandReadyService } from './next-hand-ready.service';

function mockServer(): Server {
  return {
    to: vi.fn(() => ({ emit: vi.fn() })),
    sockets: { sockets: new Map() },
  } as unknown as Server;
}

function seatTwo(
  roomService: RoomService,
  roomId: string,
): void {
  for (let i = 0; i < 2; i++) {
    const sid = `sock-t-${i}`;
    roomService.registerNickname(sid, {
      nickname: `Timer_${i}`,
      clientSessionId: `sess-t-${i}`,
    });
    roomService.joinRoom(sid, {
      roomId,
      clientSessionId: `sess-t-${i}`,
    });
  }
}

describe('ActionTimerService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets actionDeadlineAt while a player can act', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const handHistory = new HandHistoryService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('timer-deadline'),
    });
    const nextHandReady = new NextHandReadyService(roomService, tableService);
    const gameBroadcast = new GameBroadcastService(
      roomService,
      tableService,
      handHistory,
      nextHandReady,
    );
    const timer = ActionTimerService.forTest({
      roomService,
      gameService: game,
      gameBroadcast,
      handHistory,
    });

    const created = roomService.createRoom({
      settings: { maxSeats: 2, actionTimeoutSeconds: 12 },
    });
    seatTwo(roomService, created.roomId);
    game.startHand(created.roomId);

    timer.syncTimer(mockServer(), created.roomId);
    expect(roomService.getRoom(created.roomId)!.actionDeadlineAt).not.toBeNull();
  });

  it('clears deadline when hand is complete', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const handHistory = new HandHistoryService();
    const game = GameService.forTest({ roomService, tableService });
    const nextHandReady = new NextHandReadyService(roomService, tableService);
    const gameBroadcast = new GameBroadcastService(
      roomService,
      tableService,
      handHistory,
      nextHandReady,
    );
    const timer = ActionTimerService.forTest({
      roomService,
      gameService: game,
      gameBroadcast,
      handHistory,
    });

    const created = roomService.createRoom({
      settings: { maxSeats: 2, actionTimeoutSeconds: 10 },
    });
    seatTwo(roomService, created.roomId);
    let state = game.startHand(created.roomId);
    timer.syncTimer(mockServer(), created.roomId);

    state = Object.freeze({
      ...state,
      hand: Object.freeze({ ...state.hand!, isComplete: true, showdownReady: true }),
    });
    tableService.setTableState(created.roomId, state);
    timer.syncTimer(mockServer(), created.roomId);

    expect(roomService.getRoom(created.roomId)!.actionDeadlineAt).toBeNull();
  });

  it('auto-checks or folds when timer expires', async () => {
    vi.useFakeTimers();
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const handHistory = new HandHistoryService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('timer-auto-act'),
    });
    const nextHandReady = new NextHandReadyService(roomService, tableService);
    const gameBroadcast = new GameBroadcastService(
      roomService,
      tableService,
      handHistory,
      nextHandReady,
    );
    const timer = ActionTimerService.forTest({
      roomService,
      gameService: game,
      gameBroadcast,
      handHistory,
    });

    const created = roomService.createRoom({
      settings: { maxSeats: 2, actionTimeoutSeconds: 5 },
    });
    seatTwo(roomService, created.roomId);
    const state = game.startHand(created.roomId);
    const active = state.table.activeSeatIndex!;
    const before = getAvailableActions(state, active);

    timer.syncTimer(mockServer(), created.roomId);
    await vi.advanceTimersByTimeAsync(5100);

    const after = game.getGameState(created.roomId);
    const progressed =
      after.table.activeSeatIndex !== active ||
      after.hand?.street !== state.hand?.street ||
      after.hand?.isComplete === true;
    expect(progressed).toBe(true);
    expect(before.canCheck || before.canFold).toBe(true);
    expect(roomService.getRoom(created.roomId)!.actionDeadlineAt).toBeNull();
  });

  it('clearTimer removes pending timeout', () => {
    vi.useFakeTimers();
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const handHistory = new HandHistoryService();
    const game = GameService.forTest({ roomService, tableService });
    const nextHandReady = new NextHandReadyService(roomService, tableService);
    const gameBroadcast = new GameBroadcastService(
      roomService,
      tableService,
      handHistory,
      nextHandReady,
    );
    const timer = ActionTimerService.forTest({
      roomService,
      gameService: game,
      gameBroadcast,
      handHistory,
    });

    const created = roomService.createRoom({
      settings: { maxSeats: 2, actionTimeoutSeconds: 30 },
    });
    seatTwo(roomService, created.roomId);
    game.startHand(created.roomId);
    timer.syncTimer(mockServer(), created.roomId);
    timer.clearTimer(created.roomId);
    vi.advanceTimersByTime(60_000);
    const state = game.getGameState(created.roomId);
    expect(state.hand?.isComplete).not.toBe(true);
  });
});
