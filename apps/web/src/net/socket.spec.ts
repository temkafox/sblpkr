import {
  CLIENT_PLAYER_ACTION,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_START_HAND,
  SERVER_ERROR,
  SERVER_GAME_STATE,
  SERVER_HAND_RESULT,
  SERVER_ROOM_STATE,
} from '@neonpoker/shared';
import type {
  HandResultPayload,
  PlayerGameState,
  RoomStatePayload,
  ServerErrorPayload,
} from '@neonpoker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGameStore } from '../state/gameStore';
import { useRoomStore } from '../state/roomStore';
import { useSessionStore } from '../state/sessionStore';
import {
  connectSocket,
  joinRoom,
  requestGameState,
  resetSocketClientForTests,
  sendPlayerAction,
  startHand,
} from './socket';

const roomState: RoomStatePayload = {
  roomId: '11111111-1111-4111-8111-111111111111',
  code: 'ABC123',
  maxSeats: 9,
  players: [],
  status: 'waiting',
};

const gameState: PlayerGameState = {
  tableId: roomState.roomId,
  maxSeats: 2,
  street: null,
  boardCards: [],
  pot: { total: 0, sidePots: [] },
  dealerSeatIndex: null,
  smallBlindSeatIndex: null,
  bigBlindSeatIndex: null,
  activeSeatIndex: null,
  seats: [],
  handId: null,
  handComplete: false,
  showdownReady: false,
};

const handResult: HandResultPayload = {
  handId: 'hand-1',
  winnerSeatIndexes: [0],
  awardedAmountsBySeatIndex: { '0': 15 },
  totalAwarded: 15,
  isFoldWin: true,
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
    useGameStore.getState().clearGameState();
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

  it('SERVER_ROOM_STATE clears stale game state when fewer than two players', async () => {
    useGameStore.getState().setGameState({
      ...gameState,
      handId: 'hand-1',
      street: 'PRE-FLOP',
    });

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_ROOM_STATE, {
      ...roomState,
      players: [{ playerId: 'solo', nickname: 'Solo', seatIndex: 0 }],
    });

    expect(useGameStore.getState().gameState).toBeNull();
  });

  it('SERVER_GAME_STATE updates gameStore', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_GAME_STATE, gameState);

    expect(useGameStore.getState().gameState).toEqual(gameState);
  });

  it('SERVER_ROOM_STATE clears game loading flag', async () => {
    useGameStore.getState().setGameLoading(true);

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_ROOM_STATE, roomState);

    expect(useGameStore.getState().isGameLoading).toBe(false);
  });

  it('SERVER_ROOM_STATE clears stale errors and marks connected', async () => {
    useSessionStore.setState({
      nickname: 'alice',
      roomId: roomState.roomId,
      connectionStatus: 'error',
    });
    useRoomStore.setState({
      roomState: null,
      lastError: { code: 'ROOM_FULL', message: 'full' },
    });
    useGameStore.getState().setGameError('stale');

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_ROOM_STATE, roomState);

    expect(useSessionStore.getState().connectionStatus).toBe('connected');
    expect(useRoomStore.getState().lastError).toBeNull();
    expect(useGameStore.getState().gameError).toBeNull();
  });

  it('SERVER_GAME_STATE clears stale errors and marks connected', async () => {
    useSessionStore.setState({
      nickname: 'alice',
      roomId: roomState.roomId,
      connectionStatus: 'error',
    });
    useRoomStore.setState({
      roomState: null,
      lastError: { code: 'NICKNAME_TAKEN' },
    });
    useGameStore.getState().setGameError('stale');

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_GAME_STATE, gameState);

    expect(useSessionStore.getState().connectionStatus).toBe('connected');
    expect(useRoomStore.getState().lastError).toBeNull();
    expect(useGameStore.getState().gameError).toBeNull();
  });

  it('SERVER_GAME_STATE ignores stale active hand when roster mismatches', async () => {
    useRoomStore.setState({
      roomState: {
        ...roomState,
        players: [{ playerId: 'new-a', nickname: 'Alice', seatIndex: 0 }],
      },
    });

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_GAME_STATE, {
      ...gameState,
      handId: 'hand-1',
      street: 'PRE-FLOP',
      seats: [
        {
          seatIndex: 0,
          playerId: 'old-a',
          nickname: 'Alice',
          stack: 200,
          currentBet: 1,
          hasFolded: false,
          isAllIn: false,
          isSittingOut: false,
          holeCards: null,
          holeCardCount: 2,
        },
      ],
    });

    expect(useGameStore.getState().gameState).toBeNull();
  });

  it('SERVER_HAND_RESULT updates gameStore', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_HAND_RESULT, handResult);

    expect(useGameStore.getState().handResult).toEqual(handResult);
  });

  it('requestGameState emits CLIENT_REQUEST_GAME_STATE', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    requestGameState(roomState.roomId);

    expect(mockEmit).toHaveBeenCalledWith(CLIENT_REQUEST_GAME_STATE, {
      roomId: roomState.roomId,
    });
    expect(useGameStore.getState().isGameLoading).toBe(true);
  });

  it('startHand emits CLIENT_START_HAND', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    startHand(roomState.roomId);

    expect(mockEmit).toHaveBeenCalledWith(CLIENT_START_HAND, {
      roomId: roomState.roomId,
    });
  });

  it('sendPlayerAction emits CLIENT_PLAYER_ACTION without seatIndex', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    sendPlayerAction(roomState.roomId, { kind: 'fold' });

    expect(mockEmit).toHaveBeenCalledWith(CLIENT_PLAYER_ACTION, {
      roomId: roomState.roomId,
      action: { kind: 'fold' },
    });
    expect(mockEmit.mock.calls.at(-1)?.[1]).not.toHaveProperty('seatIndex');
    expect(useGameStore.getState().isSubmittingAction).toBe(true);
  });

  it('sendPlayerAction rounds fractional raise amount before emit', async () => {
    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    sendPlayerAction(roomState.roomId, { kind: 'raise', amount: 25.7 });

    expect(mockEmit).toHaveBeenCalledWith(CLIENT_PLAYER_ACTION, {
      roomId: roomState.roomId,
      action: { kind: 'raise', amount: 26 },
    });
  });

  it('SERVER_ERROR clears submitting state and surfaces gameError', async () => {
    useGameStore.getState().setSubmittingAction(true);

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_ERROR, {
      code: 'NOT_YOUR_TURN',
      message: 'Not your turn',
    });

    expect(useGameStore.getState().isSubmittingAction).toBe(false);
    expect(useGameStore.getState().gameError).toBe('Not your turn');
  });

  it('SERVER_GAME_STATE clears submitting state', async () => {
    useGameStore.getState().setSubmittingAction(true);

    const connectPromise = connectSocket();
    mockSocket.connected = true;
    fire('connect');
    await connectPromise;

    fire(SERVER_GAME_STATE, gameState);

    expect(useGameStore.getState().isSubmittingAction).toBe(false);
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
