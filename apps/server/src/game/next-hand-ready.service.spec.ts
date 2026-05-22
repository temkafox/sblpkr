import { describe, expect, it, vi } from 'vitest';
import {
  createSeededRandom,
  getPlayerAtSeat,
} from '@neonpoker/poker-core';
import { SERVER_GAME_STATE } from '@neonpoker/shared';
import type { Socket } from 'socket.io';

import { ChatService } from '../chat/chat.service';
import { RoomGateway } from '../room/room.gateway';
import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { applySeatEligibility, syncTableToRoom } from '../table/table-roster-sync';
import { ActionTimerService } from './action-timer.service';
import { GameBroadcastService } from './game-broadcast';
import { HandHistoryService } from './hand-history.service';
import { GameOrchestrationError } from './game.errors';
import { GameService } from './game.service';
import { NextHandReadyService } from './next-hand-ready.service';

function seatRoom(roomService: RoomService, count: number): string {
  const room = roomService.createRoom({ settings: { maxSeats: 9 } });
  for (let i = 0; i < count; i++) {
    const nick = `Player_${i}`;
    const reg = roomService.registerNickname(`sock-${i}`, {
      nickname: nick,
      clientSessionId: `session-${i}`,
    });
    if (!reg.ok) throw new Error('register failed');
    const join = roomService.joinRoom(`sock-${i}`, {
      roomId: room.roomId,
      clientSessionId: `session-${i}`,
    });
    if (!join.ok) throw new Error('join failed');
  }
  return room.roomId;
}

describe('NextHandReadyService (Phase 9B)', () => {
  it('hand complete creates empty ready state', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);

    const payload = ready.onHandCompleted(roomId);
    expect(payload.readyCount).toBe(0);
    expect(payload.requiredCount).toBe(2);
    expect(payload.eligiblePlayers.every((p) => !p.isReady)).toBe(true);
    expect(ready.isPhaseActive(roomId)).toBe(true);
  });

  it('eligible player can mark ready', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;
    const playerId = room.players[0]!.playerId;

    ready.onHandCompleted(roomId);
    const { payload, shouldStart } = ready.markReady(roomId, playerId);
    expect(shouldStart).toBe(false);
    expect(payload.readyCount).toBe(1);
    expect(payload.requiredCount).toBe(2);
  });

  it('busted player cannot mark ready', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;
    const bustedId = room.players[1]!.playerId;

    const game = GameService.forTest({ roomService, tableService });
    let state = game.startHand(roomId);
    const winnerId = room.players[0]!.playerId;
    state = Object.freeze({
      ...state,
      hand: Object.freeze({
        ...state.hand!,
        isComplete: true,
        showdownReady: true,
      }),
      playersById: Object.freeze({
        [winnerId]: Object.freeze({
          ...state.playersById[winnerId]!,
          chips: 400,
        }),
        [bustedId]: Object.freeze({
          ...state.playersById[bustedId]!,
          chips: 0,
          isSittingOut: true,
        }),
      }),
    });
    tableService.setTableState(roomId, applySeatEligibility(syncTableToRoom(room, state)));

    ready.onHandCompleted(roomId);
    expect(() => ready.markReady(roomId, bustedId)).toThrow(GameOrchestrationError);
    try {
      ready.markReady(roomId, bustedId);
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('NOT_ELIGIBLE_FOR_READY');
    }
  });

  it('all eligible ready triggers start via gateway helper threshold', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;

    ready.onHandCompleted(roomId);
    const first = ready.markReady(roomId, room.players[0]!.playerId);
    expect(first.shouldStart).toBe(false);
    const second = ready.markReady(roomId, room.players[1]!.playerId);
    expect(second.shouldStart).toBe(true);
    expect(second.payload.readyCount).toBe(2);
  });

  it('rebuy before next hand adds player to eligible ready list', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({ roomService, tableService });
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;
    const bustedId = room.players[1]!.playerId;

    let state = game.startHand(roomId);
    state = Object.freeze({
      ...state,
      hand: Object.freeze({ ...state.hand!, isComplete: true, showdownReady: true }),
      playersById: Object.freeze({
        [room.players[0]!.playerId]: Object.freeze({
          ...state.playersById[room.players[0]!.playerId]!,
          chips: state.playersById[room.players[0]!.playerId]!.chips +
            state.playersById[bustedId]!.chips,
        }),
        [bustedId]: Object.freeze({
          ...state.playersById[bustedId]!,
          chips: 0,
          isSittingOut: true,
        }),
      }),
    });
    tableService.setTableState(roomId, state);

    ready.onHandCompleted(roomId);
    ready.markReady(roomId, room.players[0]!.playerId);

    game.rebuy(roomId, 1);
    const payload = ready.onEligibilityChanged(roomId)!;
    expect(payload.requiredCount).toBe(2);
    expect(payload.readyCount).toBe(1);
    expect(payload.eligiblePlayers.some((p) => p.playerId === bustedId && !p.isReady)).toBe(
      true,
    );
  });

  it('disconnect removes player from ready requirement', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;

    ready.onHandCompleted(roomId);
    ready.markReady(roomId, room.players[0]!.playerId);
    ready.markReady(roomId, room.players[1]!.playerId);

    roomService.handleDisconnect(room.players[1]!.socketId!);
    const member = roomService.getRoom(roomId)!.players[1]!;
    expect(member.connectionStatus).toBe('disconnected');

    const payload = ready.onEligibilityChanged(roomId)!;
    expect(payload.requiredCount).toBe(1);
    expect(payload.readyCount).toBe(1);
  });

  it('ready state clears after next hand starts', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('ready-clear'),
    });
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);

    let state = game.startHand(roomId);
    state = Object.freeze({
      ...state,
      hand: Object.freeze({ ...state.hand!, isComplete: true, showdownReady: true }),
    });
    tableService.setTableState(roomId, state);

    ready.onHandCompleted(roomId);
    const room = roomService.getRoom(roomId)!;
    ready.markReady(roomId, room.players[0]!.playerId);
    ready.markReady(roomId, room.players[1]!.playerId);

    game.startHand(roomId);
    ready.clearPhase(roomId);
    expect(ready.isPhaseActive(roomId)).toBe(false);
    expect(ready.clearedPayload(roomId).requiredCount).toBe(0);
  });

  it('RoomGateway.handleStartHand emits SERVER_GAME_STATE when ready phase inactive', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('gw-direct-start'),
    });
    const handHistory = new HandHistoryService();
    const nextHandReady = new NextHandReadyService(roomService, tableService);
    const gameBroadcast = new GameBroadcastService(
      roomService,
      tableService,
      handHistory,
      nextHandReady,
    );
    const actionTimer = new ActionTimerService(
      roomService,
      game,
      gameBroadcast,
      handHistory,
    );
    const gateway = new RoomGateway(
      roomService,
      game,
      gameBroadcast,
      nextHandReady,
      new ChatService(),
      actionTimer,
    );

    const roomId = seatRoom(roomService, 2);
    const emit0 = vi.fn();
    const emit1 = vi.fn();
    gateway.server = {
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: {
        sockets: new Map<string, Socket>([
          ['sock-0', { emit: emit0 } as unknown as Socket],
          ['sock-1', { emit: emit1 } as unknown as Socket],
        ]),
      },
    } as unknown as typeof gateway.server;

    gateway.handleStartHand({ id: 'sock-0' } as Socket, { roomId });

    expect(emit0).toHaveBeenCalledWith(
      SERVER_GAME_STATE,
      expect.objectContaining({ handId: expect.any(String) }),
    );
    expect(emit1).toHaveBeenCalledWith(
      SERVER_GAME_STATE,
      expect.objectContaining({ handId: expect.any(String) }),
    );
  });

  it('first hand still starts via GameService.startHand when no ready phase', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('first-hand'),
    });
    const ready = new NextHandReadyService(roomService, tableService);
    const roomId = seatRoom(roomService, 2);

    expect(ready.isPhaseActive(roomId)).toBe(false);
    const started = game.startHand(roomId);
    expect(getPlayerAtSeat(started, 0)!.holeCards.length).toBe(2);
    expect(getPlayerAtSeat(started, 1)!.holeCards.length).toBe(2);
  });
});
