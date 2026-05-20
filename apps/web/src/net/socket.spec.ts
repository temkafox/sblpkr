import { SERVER_ERROR, SERVER_ROOM_STATE } from '@neonpoker/shared';
import type { RoomStatePayload, ServerErrorPayload } from '@neonpoker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRoomStore } from '../state/roomStore';
import { useSessionStore } from '../state/sessionStore';
import {
  connectSocket,
  joinRoom,
  resetSocketClientForTests,
} from './socket';

const roomState: RoomStatePayload = {
  roomId: '11111111-1111-4111-8111-111111111111',
  code: 'ABC123',
  maxSeats: 9,
  players: [],
  status: 'waiting',
};

type Handler = (...args: unknown[]) => void;

const handlers = new Map<string, Handler[]>();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();
const mockRemoveAllListeners = vi.fn();

const mockSocket = {
  connected: false,
  on: vi.fn((event: string, handler: Handler) => {
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
  }),
  once: vi.fn((event: string, handler: Handler) => {
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
  }),
  off: vi.fn((event: string, handler: Handler) => {
    const list = handlers.get(event) ?? [];
    handlers.set(
      event,
      list.filter((h) => h !== handler),
    );
  }),
  emit: mockEmit,
  disconnect: mockDisconnect,
  removeAllListeners: mockRemoveAllListeners,
};

function fire(event: string, ...args: unknown[]) {
  for (const handler of handlers.get(event) ?? []) {
    handler(...args);
  }
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('socket client', () => {
  beforeEach(() => {
    handlers.clear();
    mockEmit.mockClear();
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.once.mockClear();
    resetSocketClientForTests();
    useRoomStore.setState({ roomState: null, lastError: null });
    useSessionStore.setState({
      nickname: null,
      roomId: null,
      connectionStatus: 'idle',
    });
  });

  afterEach(() => {
    resetSocketClientForTests();
  });

  it('SERVER_ROOM_STATE updates roomStore', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_ROOM_STATE, roomState);

    expect(useRoomStore.getState().roomState).toEqual(roomState);
    expect(useSessionStore.getState().connectionStatus).toBe('connected');
  });

  it('SERVER_ERROR updates roomStore lastError', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    const err: ServerErrorPayload = {
      code: 'NICKNAME_TAKEN',
      message: 'Taken',
    };
    fire(SERVER_ERROR, err);

    expect(useRoomStore.getState().lastError).toEqual(err);
    expect(useSessionStore.getState().connectionStatus).toBe('error');
  });

  it('joinRoom resolves on SERVER_ROOM_STATE', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    const joinPromise = joinRoom(roomState.roomId);
    fire(SERVER_ROOM_STATE, roomState);

    await expect(joinPromise).resolves.toEqual(roomState);
    expect(mockEmit).toHaveBeenCalledWith('CLIENT_JOIN_ROOM', {
      roomId: roomState.roomId,
    });
  });
});
