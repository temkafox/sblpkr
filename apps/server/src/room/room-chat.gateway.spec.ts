import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CLIENT_JOIN_ROOM,
  CLIENT_REGISTER_NICKNAME,
  CLIENT_REQUEST_CHAT_MESSAGES,
  CLIENT_SEND_CHAT_MESSAGE,
  SERVER_CHAT_MESSAGES,
  SERVER_ERROR,
  SERVER_ROOM_STATE,
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
    socket.on(CLIENT_SEND_CHAT_MESSAGE, (payload: unknown) => {
      gateway.handleSendChatMessage(socket, payload);
    });
    socket.on(CLIENT_REQUEST_CHAT_MESSAGES, (payload: unknown) => {
      gateway.handleRequestChatMessages(socket, payload);
    });
    socket.on('disconnect', () => {
      gateway.handleDisconnect(socket);
    });
  });
}

async function waitForConnect(client: ClientSocket): Promise<void> {
  if (client.connected) {
    return;
  }
  await new Promise<void>((resolve) => client.once('connect', () => resolve()));
}

async function joinPlayer(
  client: ClientSocket,
  roomId: string,
  nickname: string,
  clientSessionId: string,
): Promise<void> {
  await waitForConnect(client);
  client.emit(CLIENT_REGISTER_NICKNAME, { nickname, clientSessionId });
  const joined = waitForEvent(client, SERVER_ROOM_STATE);
  client.emit(CLIENT_JOIN_ROOM, { roomId, clientSessionId });
  await joined;
}

describe('RoomGateway chat (Socket.IO)', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let gateway: RoomGateway;
  let roomService: RoomService;
  let chatService: ChatService;
  let port = 0;

  beforeAll(async () => {
    let seq = 0;
    roomService = RoomService.forTest({
      code: () => {
        seq += 1;
        return `C${String(seq).padStart(5, '0')}`.slice(0, 6);
      },
      id: () => {
        const suffix = String(seq).padStart(12, '0');
        return `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`;
      },
    });
    chatService = new ChatService();
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
      chatService,
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

  it('rejects unjoined socket', async () => {
    const room = roomService.createRoom();
    const outsider = connectClient(port);
    await waitForConnect(outsider);

    const err = waitForEvent<{ code: string }>(outsider, SERVER_ERROR);
    outsider.emit(CLIENT_SEND_CHAT_MESSAGE, {
      roomId: room.roomId,
      text: 'hello',
    });
    expect((await err).code).toBe('NOT_JOINED');
    outsider.disconnect();
  });

  it('rejects missing room', async () => {
    const room = roomService.createRoom();
    const client = connectClient(port);
    await joinPlayer(client, room.roomId, 'Alice', 'chat-missing');

    const err = waitForEvent<{ code: string }>(client, SERVER_ERROR);
    client.emit(CLIENT_SEND_CHAT_MESSAGE, {
      roomId: '00000000-0000-4000-8000-000000000099',
      text: 'hello',
    });
    expect((await err).code).toBe('ROOM_NOT_FOUND');
    client.disconnect();
  });

  it('rejects empty message and broadcasts to room on send', async () => {
    const room = roomService.createRoom();
    const a = connectClient(port);
    const b = connectClient(port);

    await joinPlayer(a, room.roomId, 'Alice', 'chat-alice');
    await joinPlayer(b, room.roomId, 'Bob', 'chat-bob');

    const invalid = waitForEvent<{ code: string }>(a, SERVER_ERROR);
    a.emit(CLIENT_SEND_CHAT_MESSAGE, { roomId: room.roomId, text: '   ' });
    expect((await invalid).code).toBe('INVALID_PAYLOAD');

    const bChat = waitForEvent<{ messages: { text: string; nickname: string }[] }>(
      b,
      SERVER_CHAT_MESSAGES,
    );
    a.emit(CLIENT_SEND_CHAT_MESSAGE, { roomId: room.roomId, text: '  gl hf  ' });
    const snapshot = await bChat;
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]!.text).toBe('gl hf');
    expect(snapshot.messages[0]!.nickname).toBe('Alice');

    a.disconnect();
    b.disconnect();
  });

  it('returns current messages only to requesting socket', async () => {
    const room = roomService.createRoom();
    chatService.addMessage(room.roomId, { playerId: 'seed', nickname: 'Seed' }, 'prior');

    const a = connectClient(port);
    await joinPlayer(a, room.roomId, 'Alice', 'chat-req-a');

    const outsider = connectClient(port);
    await waitForConnect(outsider);

    const snapshotPromise = waitForEvent<{ messages: { text: string }[] }>(
      a,
      SERVER_CHAT_MESSAGES,
    );
    a.emit(CLIENT_REQUEST_CHAT_MESSAGES, { roomId: room.roomId });
    const snapshot = await snapshotPromise;
    expect(snapshot.messages.map((m) => m.text)).toEqual(['prior']);

    const err = waitForEvent<{ code: string }>(outsider, SERVER_ERROR);
    outsider.emit(CLIENT_REQUEST_CHAT_MESSAGES, { roomId: room.roomId });
    expect((await err).code).toBe('NOT_JOINED');

    a.disconnect();
    outsider.disconnect();
  });

  it('rejoined socket receives prior messages on request', async () => {
    const room = roomService.createRoom();
    chatService.addMessage(
      room.roomId,
      { playerId: 'p-alice', nickname: 'Alice' },
      'before refresh',
    );

    const a = connectClient(port);
    await joinPlayer(a, room.roomId, 'Alice', 'chat-rejoin-a');
    a.disconnect();

    const a2 = connectClient(port);
    await joinPlayer(a2, room.roomId, 'Alice', 'chat-rejoin-a');

    const snapshotPromise = waitForEvent<{ messages: { text: string }[] }>(
      a2,
      SERVER_CHAT_MESSAGES,
    );
    a2.emit(CLIENT_REQUEST_CHAT_MESSAGES, { roomId: room.roomId });
    const snapshot = await snapshotPromise;
    expect(snapshot.messages.map((m) => m.text)).toEqual(['before refresh']);

    a2.disconnect();
  });

  it('caps stored messages at 100 per room', () => {
    const room = roomService.createRoom();
    for (let i = 0; i < 105; i += 1) {
      chatService.addMessage(
        room.roomId,
        { playerId: 'p1', nickname: 'Alice' },
        `m${i}`,
      );
    }
    expect(chatService.getMessages(room.roomId).messages).toHaveLength(100);
    expect(chatService.getMessages(room.roomId).messages[0]!.text).toBe('m5');
  });
});
