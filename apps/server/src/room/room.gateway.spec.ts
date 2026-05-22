import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CLIENT_JOIN_ROOM,
  CLIENT_LEAVE_ROOM,
  CLIENT_REGISTER_NICKNAME,
  SERVER_ERROR,
  SERVER_ROOM_STATE,
  RoomStateSchema,
} from '@neonpoker/shared';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import { ChatService } from '../chat/chat.service';
import { ActionTimerService } from '../game/action-timer.service';
import { GameBroadcastService } from '../game/game-broadcast';
import { HandHistoryService } from '../game/hand-history.service';
import { NextHandReadyService } from '../game/next-hand-ready.service';
import { GameService } from '../game/game.service';
import { TableService } from '../table/table.service';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';

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
    socket.on(CLIENT_JOIN_ROOM, async (payload: unknown) => {
      await gateway.handleJoinRoom(socket, payload);
    });
    socket.on(CLIENT_LEAVE_ROOM, (payload: unknown) => {
      void gateway.handleLeaveRoom(socket, payload);
    });
    socket.on('disconnect', () => {
      gateway.handleDisconnect(socket);
    });
  });
}

describe('RoomGateway (Socket.IO)', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let gateway: RoomGateway;
  let roomService: RoomService;
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

    const tableService = new TableService();
    const gameService = GameService.forTest({ roomService, tableService });
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
      gameService,
      gameBroadcast,
      handHistory,
    );
    gateway = new RoomGateway(
      roomService,
      gameService,
      gameBroadcast,
      nextHandReady,
      new ChatService(),
      actionTimer,
    );
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

  it('broadcasts ROOM_STATE when clients join', async () => {
    const room = roomService.createRoom({ settings: { maxSeats: 6 } });

    const a = connectClient(port);
    const b = connectClient(port);

    await Promise.all([
      new Promise<void>((r) => a.once('connect', () => r())),
      new Promise<void>((r) => b.once('connect', () => r())),
    ]);

    a.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Alice',
      clientSessionId: 'gw-alice',
    });
    b.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Bob',
      clientSessionId: 'gw-bob',
    });

    const stateA = waitForEvent(a, SERVER_ROOM_STATE);
    a.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-alice',
    });
    const parsedA = RoomStateSchema.parse(await stateA);

    const stateB = waitForEvent(b, SERVER_ROOM_STATE);
    b.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-bob',
    });
    const parsedB = RoomStateSchema.parse(await stateB);

    expect(parsedA.players.map((p) => p.nickname)).toEqual(['Alice']);
    expect(parsedB.players.map((p) => p.nickname).sort()).toEqual([
      'Alice',
      'Bob',
    ]);

    a.disconnect();
    b.disconnect();
  });

  it('emits SERVER_ERROR for duplicate nickname', async () => {
    const room = roomService.createRoom();

    const a = connectClient(port);
    const b = connectClient(port);

    await Promise.all([
      new Promise<void>((r) => a.once('connect', () => r())),
      new Promise<void>((r) => b.once('connect', () => r())),
    ]);

    a.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Dup',
      clientSessionId: 'gw-dup-a',
    });
    b.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'dup',
      clientSessionId: 'gw-dup-b',
    });

    a.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-dup-a',
    });
    await waitForEvent(a, SERVER_ROOM_STATE);

    const err = waitForEvent<{ code: string }>(b, SERVER_ERROR);
    b.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-dup-b',
    });

    expect((await err).code).toBe('NICKNAME_TAKEN');

    a.disconnect();
    b.disconnect();
  });

  it('updates ROOM_STATE after LEAVE_ROOM', async () => {
    const room = roomService.createRoom();

    const a = connectClient(port);
    const b = connectClient(port);

    await Promise.all([
      new Promise<void>((r) => a.once('connect', () => r())),
      new Promise<void>((r) => b.once('connect', () => r())),
    ]);

    a.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Stay',
      clientSessionId: 'gw-stay-a',
    });
    b.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Leaver',
      clientSessionId: 'gw-leave-b',
    });

    a.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-stay-a',
    });
    await waitForEvent(a, SERVER_ROOM_STATE);

    b.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-leave-b',
    });
    await waitForEvent(b, SERVER_ROOM_STATE);

    const update = waitForEvent(a, SERVER_ROOM_STATE);
    b.emit(CLIENT_LEAVE_ROOM, { roomId: room.roomId });

    const afterLeave = RoomStateSchema.parse(await update);
    expect(afterLeave.players).toHaveLength(1);
    expect(afterLeave.players[0]!.nickname).toBe('Stay');

    a.disconnect();
    b.disconnect();
  });

  it('keeps roster during disconnect grace', async () => {
    const room = roomService.createRoom();

    const a = connectClient(port);
    const b = connectClient(port);

    await Promise.all([
      new Promise<void>((r) => a.once('connect', () => r())),
      new Promise<void>((r) => b.once('connect', () => r())),
    ]);

    a.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Stay',
      clientSessionId: 'gw-stay-grace',
    });
    b.emit(CLIENT_REGISTER_NICKNAME, {
      nickname: 'Drop',
      clientSessionId: 'gw-drop-grace',
    });

    a.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-stay-grace',
    });
    await waitForEvent(a, SERVER_ROOM_STATE);

    b.emit(CLIENT_JOIN_ROOM, {
      roomId: room.roomId,
      clientSessionId: 'gw-drop-grace',
    });
    await waitForEvent(b, SERVER_ROOM_STATE);

    b.disconnect();
    await new Promise((r) => setTimeout(r, 50));

    expect(roomService.getRoomState(room.roomId)!.players).toHaveLength(2);

    a.disconnect();
  });
});
