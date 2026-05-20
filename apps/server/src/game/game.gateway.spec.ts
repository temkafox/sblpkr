import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSeededRandom } from '@neonpoker/poker-core';
import {
  CLIENT_JOIN_ROOM,
  CLIENT_PLAYER_ACTION,
  CLIENT_REGISTER_NICKNAME,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_REBUY,
  CLIENT_START_HAND,
  PlayerActionPayloadSchema,
  PlayerGameStateSchema,
  SERVER_ERROR,
  SERVER_GAME_STATE,
  SERVER_HAND_RESULT,
  SERVER_ROOM_STATE,
  RoomStateSchema,
  StartHandPayloadSchema,
} from '@neonpoker/shared';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import { DEFAULT_REBUY_CHIPS } from './game.constants';
import { GameBroadcastService } from './game-broadcast';
import { HandHistoryService } from './hand-history.service';
import { GameService } from './game.service';
import { containsPrivateEngineFields } from './game-state-view';
import { RoomGateway } from '../room/room.gateway';
import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ${event}`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connectClient(port: number): ClientSocket {
  return ioClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });
}

function attachGatewayHandlers(io: Server, gateway: RoomGateway): void {
  io.on('connection', (socket) => {
    socket.on(CLIENT_REGISTER_NICKNAME, (payload: unknown) => {
      gateway.handleRegisterNickname(socket, payload);
    });
    socket.on(CLIENT_JOIN_ROOM, (payload: unknown) => {
      void gateway.handleJoinRoom(socket, payload);
    });
    socket.on('disconnect', () => {
      gateway.handleDisconnect(socket);
    });
    socket.on(CLIENT_START_HAND, (payload: unknown) => {
      gateway.handleStartHand(socket, payload);
    });
    socket.on(CLIENT_REBUY, (payload: unknown) => {
      gateway.handleRebuy(socket, payload);
    });
    socket.on(CLIENT_PLAYER_ACTION, (payload: unknown) => {
      gateway.handlePlayerAction(socket, payload);
    });
    socket.on(CLIENT_REQUEST_GAME_STATE, (payload: unknown) => {
      gateway.handleRequestGameState(socket, payload);
    });
  });
}

describe('Game gateway (Phase 6C2)', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let gateway: RoomGateway;
  let roomService: RoomService;
  let tableService: TableService;
  let port = 0;

  beforeAll(async () => {
    let seq = 0;
    roomService = RoomService.forTest({
      code: () => {
        seq += 1;
        return `G${String(seq).padStart(5, '0')}`.slice(0, 6);
      },
      id: () => {
        const suffix = String(seq).padStart(12, '0');
        return `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`;
      },
    });
    tableService = new TableService();
    const gameService = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom(`6c2-gw-${seq}`),
    });
    const handHistory = new HandHistoryService();
    const gameBroadcast = new GameBroadcastService(
      roomService,
      tableService,
      handHistory,
    );
    gateway = new RoomGateway(roomService, gameService, gameBroadcast);
    gateway.onModuleInit();

    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: true } });
    gateway.server = io;
    attachGatewayHandlers(io, gateway);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  async function seatTwo(roomId: string): Promise<{
    a: ClientSocket;
    b: ClientSocket;
  }> {
    const a = connectClient(port);
    const b = connectClient(port);
    await Promise.all([
      new Promise<void>((r) => a.once('connect', () => r())),
      new Promise<void>((r) => b.once('connect', () => r())),
    ]);
    a.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Alpha',
      clientSessionId: 'gw-game-alpha',
    });
    b.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Beta',
      clientSessionId: 'gw-game-beta',
    });
    a.emit(CLIENT_JOIN_ROOM, {
      roomId,
      clientSessionId: 'gw-game-alpha',
    });
    await waitForEvent(a, SERVER_ROOM_STATE);
    b.emit(CLIENT_JOIN_ROOM, {
      roomId,
      clientSessionId: 'gw-game-beta',
    });
    await waitForEvent(b, SERVER_ROOM_STATE);
    return { a, b };
  }

  it('broadcasts per-viewer SERVER_GAME_STATE on start hand', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);

    const stateA = waitForEvent(a, SERVER_GAME_STATE);
    const stateB = waitForEvent(b, SERVER_GAME_STATE);
    a.emit(CLIENT_START_HAND, { roomId: room.roomId });

    const viewA = PlayerGameStateSchema.parse(await stateA);
    const viewB = PlayerGameStateSchema.parse(await stateB);

    expect(viewA.seats[0]!.holeCards).toHaveLength(2);
    expect(viewA.seats[1]!.holeCards).toBeNull();
    expect(viewB.seats[1]!.holeCards).toHaveLength(2);
    expect(viewB.seats[0]!.holeCards).toBeNull();
    expect(containsPrivateEngineFields(viewA)).toBe(false);

    a.disconnect();
    b.disconnect();
  });

  it('rejects start hand with fewer than 2 players', async () => {
    const room = roomService.createRoom();
    const solo = connectClient(port);
    await new Promise<void>((r) => solo.once('connect', () => r()));
    solo.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Solo',
      clientSessionId: 'gw-game-solo',
    });
    solo.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-game-solo',
    });
    await waitForEvent(solo, SERVER_ROOM_STATE);

    const err = waitForEvent<{ code: string }>(solo, SERVER_ERROR);
    solo.emit(CLIENT_START_HAND, { roomId: room.roomId });
    expect((await err).code).toBe('NOT_ENOUGH_PLAYERS');

    solo.disconnect();
  });

  it('returns NOT_YOUR_TURN for out-of-turn action', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);

    const stateA = waitForEvent(a, SERVER_GAME_STATE);
    const stateB = waitForEvent(b, SERVER_GAME_STATE);
    a.emit(CLIENT_START_HAND, { roomId: room.roomId });
    const viewA = PlayerGameStateSchema.parse(await stateA);
    await stateB;

    const active = viewA.activeSeatIndex;
    const wrong = active === 0 ? b : a;
    const err = waitForEvent<{ code: string }>(wrong, SERVER_ERROR);
    wrong.emit(CLIENT_PLAYER_ACTION, {
      roomId: room.roomId,
      action: { kind: 'fold' },
    });
    expect((await err).code).toBe('NOT_YOUR_TURN');

    a.disconnect();
    b.disconnect();
  });

  it('request game state returns only viewer hole cards', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);

    a.emit(CLIENT_START_HAND, { roomId: room.roomId });
    await waitForEvent(a, SERVER_GAME_STATE);
    await waitForEvent(b, SERVER_GAME_STATE);

    const req = waitForEvent(a, SERVER_GAME_STATE);
    a.emit(CLIENT_REQUEST_GAME_STATE, { roomId: room.roomId });
    const view = PlayerGameStateSchema.parse(await req);

    expect(view.seats[0]!.holeCards).toHaveLength(2);
    expect(view.seats[1]!.holeCards).toBeNull();

    a.disconnect();
    b.disconnect();
  });

  it('rejects unjoined socket for start hand', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const outsider = connectClient(port);
    await new Promise<void>((r) => outsider.once('connect', () => r()));
    outsider.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Outsider',
      clientSessionId: 'gw-game-outsider',
    });

    const err = waitForEvent<{ code: string }>(outsider, SERVER_ERROR);
    outsider.emit(CLIENT_START_HAND, { roomId: room.roomId });
    expect((await err).code).toBe('NOT_JOINED');

    outsider.disconnect();
  });

  it('rejects invalid action payload', () => {
    expect(() =>
      PlayerActionPayloadSchema.parse({ action: { kind: 'fold' } }),
    ).toThrow();
    expect(() =>
      PlayerActionPayloadSchema.parse({
        roomId: 'room-1',
        action: { kind: 'raise', amount: 25.5 },
      }),
    ).toThrow();
    expect(() => StartHandPayloadSchema.parse({ roomId: '' })).toThrow();
  });

  it('updates all sockets after action', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);

    const startA = waitForEvent(a, SERVER_GAME_STATE);
    const startB = waitForEvent(b, SERVER_GAME_STATE);
    a.emit(CLIENT_START_HAND, { roomId: room.roomId });
    const opened = PlayerGameStateSchema.parse(await startA);
    await startB;

    const actor = opened.activeSeatIndex === 0 ? a : b;
    const updA = waitForEvent(a, SERVER_GAME_STATE);
    const updB = waitForEvent(b, SERVER_GAME_STATE);
    actor.emit(CLIENT_PLAYER_ACTION, {
      roomId: room.roomId,
      action: { kind: 'call' },
    });

    const viewA = PlayerGameStateSchema.parse(await updA);
    const viewB = PlayerGameStateSchema.parse(await updB);
    expect(viewA.pot.total).toBeGreaterThan(0);
    expect(viewB.pot.total).toBe(viewA.pot.total);

    a.disconnect();
    b.disconnect();
  });

  it('keeps roster during disconnect grace without immediate hand reset', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);

    const startA = waitForEvent(a, SERVER_GAME_STATE);
    const startB = waitForEvent(b, SERVER_GAME_STATE);
    a.emit(CLIENT_START_HAND, { roomId: room.roomId });
    const opened = PlayerGameStateSchema.parse(await startA);
    await startB;
    expect(opened.handId).not.toBeNull();

    const roomUpdate = waitForEvent(a, SERVER_ROOM_STATE);
    const gameUpdate = waitForEvent(a, SERVER_GAME_STATE);
    b.disconnect();

    const afterDisconnect = RoomStateSchema.parse(await roomUpdate);
    expect(afterDisconnect.players).toHaveLength(2);
    const dropped = afterDisconnect.players.find((p) => p.nickname === 'Beta');
    expect(dropped?.connectionStatus).toBe('disconnected');

    const afterGame = PlayerGameStateSchema.parse(await gameUpdate);
    const droppedSeat = afterGame.seats.find((s) => s.nickname === 'Beta');
    expect(droppedSeat?.connectionStatus).toBe('disconnected');
    expect(JSON.stringify(afterGame)).not.toContain('socketId');

    a.disconnect();
  });

  it('emits SERVER_HAND_RESULT when hand completes via fold', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);

    const startA = waitForEvent(a, SERVER_GAME_STATE);
    const startB = waitForEvent(b, SERVER_GAME_STATE);
    a.emit(CLIENT_START_HAND, { roomId: room.roomId });
    const opened = PlayerGameStateSchema.parse(await startA);
    await startB;

    const active = opened.activeSeatIndex ?? 0;
    const actor = active === 0 ? a : b;
    const other = active === 0 ? b : a;

    actor.emit(CLIENT_PLAYER_ACTION, {
      roomId: room.roomId,
      action: { kind: 'call' },
    });
    await waitForEvent(a, SERVER_GAME_STATE);
    await waitForEvent(b, SERVER_GAME_STATE);

    const resultP = waitForEvent<{
      winnerSeatIndexes: number[];
      totalAwarded: number;
      awardedAmountsBySeatIndex: Record<string, number>;
    }>(
      actor,
      SERVER_HAND_RESULT,
    );
    other.emit(CLIENT_PLAYER_ACTION, {
      roomId: room.roomId,
      action: { kind: 'fold' },
    });
    await waitForEvent(actor, SERVER_GAME_STATE);

    const result = await resultP;
    expect(result.winnerSeatIndexes).toContain(active);
    expect(result.totalAwarded).toBeGreaterThan(0);
    expect(result.awardedAmountsBySeatIndex[String(active)]).toBeGreaterThan(0);

    a.disconnect();
    b.disconnect();
  });

  it('CLIENT_REBUY restores busted player and broadcasts SERVER_GAME_STATE', async () => {
    const room = roomService.createRoom({ maxSeats: 6 });
    const { a, b } = await seatTwo(room.roomId);
    const roomState = roomService.getRoom(room.roomId)!;
    const bustedId = roomState.players[1]!.playerId;
    const winnerId = roomState.players[0]!.playerId;

    let core = tableService.ensureTableForRoom(roomState);
    core = Object.freeze({
      ...core,
      playersById: Object.freeze({
        [winnerId]: Object.freeze({
          ...core.playersById[winnerId]!,
          chips: 400,
        }),
        [bustedId]: Object.freeze({
          ...core.playersById[bustedId]!,
          chips: 0,
          isSittingOut: true,
        }),
      }),
    });
    tableService.setTableState(room.roomId, core);

    const rebuyA = waitForEvent(a, SERVER_GAME_STATE);
    const rebuyB = waitForEvent(b, SERVER_GAME_STATE);
    b.emit(CLIENT_REBUY, { roomId: room.roomId });

    const viewB = PlayerGameStateSchema.parse(await rebuyB);
    const viewA = PlayerGameStateSchema.parse(await rebuyA);
    expect(viewB.seats[1]!.stack).toBe(DEFAULT_REBUY_CHIPS);
    expect(viewB.seats[1]!.isSittingOut).toBe(false);
    expect(viewA.seats[0]!.stack).toBe(400);
    expect(viewA.seats[1]!.isSittingOut).toBe(false);
    expect(viewA.handId).toBeNull();
    expect(viewB.handId).toBeNull();

    a.disconnect();
    b.disconnect();
  });
});
