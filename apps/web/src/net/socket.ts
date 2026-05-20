import {
  CLIENT_JOIN_ROOM,
  CLIENT_LEAVE_ROOM,
  CLIENT_PLAYER_ACTION,
  CLIENT_REGISTER_NICKNAME,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_START_HAND,
  SERVER_ERROR,
  SERVER_GAME_STATE,
  SERVER_HAND_RESULT,
  SERVER_ROOM_STATE,
} from '@neonpoker/shared';
import type {
  HandResultPayload,
  PlayerActionIntent,
  PlayerGameState,
  RoomStatePayload,
  ServerErrorPayload,
} from '@neonpoker/shared';
import { io, type Socket } from 'socket.io-client';

import {
  shouldAcceptGameStatePayload,
  shouldClearGameStateForRoom,
} from '../lib/gameStateRoster';
import { useGameStore } from '../state/gameStore';
import { useRoomStore } from '../state/roomStore';
import {
  type ConnectionStatus,
  useSessionStore,
} from '../state/sessionStore';
import { getApiBaseUrl } from './http';

const JOIN_TIMEOUT_MS = 8_000;

let socket: Socket | null = null;
let listenersAttached = false;

const gameStateListeners = new Set<(state: PlayerGameState) => void>();
const handResultListeners = new Set<(result: HandResultPayload) => void>();

export class SocketRoomError extends Error {
  readonly code: string;
  readonly serverMessage?: string;

  constructor(payload: ServerErrorPayload) {
    const message = payload.message ?? payload.code;
    super(message);
    this.name = 'SocketRoomError';
    this.code = payload.code;
    this.serverMessage = payload.message;
  }
}

function setConnectionStatus(status: ConnectionStatus): void {
  useSessionStore.getState().setConnectionStatus(status);
}

function attachGlobalListeners(client: Socket): void {
  if (listenersAttached) return;
  listenersAttached = true;

  client.on(SERVER_ROOM_STATE, (payload: RoomStatePayload) => {
    useRoomStore.getState().setRoomState(payload);
    if (
      shouldClearGameStateForRoom(
        payload,
        useGameStore.getState().gameState,
      )
    ) {
      useGameStore.getState().clearGameState();
    }
    useGameStore.getState().setGameError(null);
    useGameStore.getState().setGameLoading(false);
    setConnectionStatus('connected');
  });

  client.on(SERVER_GAME_STATE, (payload: PlayerGameState) => {
    const room = useRoomStore.getState().roomState;
    if (!shouldAcceptGameStatePayload(payload, room)) {
      useGameStore.getState().clearGameState();
      return;
    }
    useGameStore.getState().setGameState(payload);
    useRoomStore.getState().clearLastError();
    setConnectionStatus('connected');
    for (const listener of gameStateListeners) {
      listener(payload);
    }
  });

  client.on(SERVER_HAND_RESULT, (payload: HandResultPayload) => {
    useGameStore.getState().setHandResult(payload);
    useGameStore.getState().setSubmittingAction(false);
    for (const listener of handResultListeners) {
      listener(payload);
    }
  });

  client.on(SERVER_ERROR, (payload: ServerErrorPayload) => {
    useRoomStore.getState().setError(payload);
    useGameStore.getState().setGameError(payload.message ?? payload.code);
    setConnectionStatus('error');
  });

  client.on('disconnect', () => {
    if (useSessionStore.getState().connectionStatus !== 'connecting') {
      setConnectionStatus('idle');
    }
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) {
    attachGlobalListeners(socket);
    return socket;
  }

  setConnectionStatus('connecting');

  return new Promise((resolve, reject) => {
    const client = io(getApiBaseUrl(), {
      transports: ['websocket'],
      autoConnect: true,
    });
    socket = client;

    const onConnect = () => {
      cleanup();
      attachGlobalListeners(client);
      resolve(client);
    };

    const onConnectError = (err: Error) => {
      cleanup();
      socket = null;
      listenersAttached = false;
      setConnectionStatus('error');
      reject(err);
    };

    const cleanup = () => {
      client.off('connect', onConnect);
      client.off('connect_error', onConnectError);
    };

    client.on('connect', onConnect);
    client.on('connect_error', onConnectError);
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket?.removeAllListeners();
  socket = null;
  listenersAttached = false;
  gameStateListeners.clear();
  handResultListeners.clear();
  useGameStore.getState().clearHandResult();
  setConnectionStatus('idle');
}

export function registerNickname(nickname: string): void {
  socket?.emit(CLIENT_REGISTER_NICKNAME, { nickname });
}

export function leaveRoom(roomId?: string): void {
  if (roomId) {
    socket?.emit(CLIENT_LEAVE_ROOM, { roomId });
  } else {
    socket?.emit(CLIENT_LEAVE_ROOM, {});
  }
  useGameStore.getState().clearHandResult();
}

export function joinRoom(roomId: string): Promise<RoomStatePayload> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onState = (payload: RoomStatePayload) => {
      useRoomStore.getState().setRoomState(payload);
      useGameStore.getState().setGameError(null);
      useGameStore.getState().setGameLoading(false);
      setConnectionStatus('connected');
      finish(() => resolve(payload));
    };

    const onError = (payload: ServerErrorPayload) => {
      finish(() => reject(new SocketRoomError(payload)));
    };

    const cleanup = () => {
      socket?.off(SERVER_ROOM_STATE, onState);
      socket?.off(SERVER_ERROR, onError);
      clearTimeout(timer);
    };

    socket.once(SERVER_ROOM_STATE, onState);
    socket.once(SERVER_ERROR, onError);

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Join timed out')));
    }, JOIN_TIMEOUT_MS);

    socket.emit(CLIENT_JOIN_ROOM, { roomId });
  });
}

export function requestGameState(roomId: string): void {
  useGameStore.getState().setGameLoading(true);
  socket?.emit(CLIENT_REQUEST_GAME_STATE, { roomId });
}

export function startHand(roomId: string): void {
  socket?.emit(CLIENT_START_HAND, { roomId });
}

export function sendPlayerAction(
  roomId: string,
  action: PlayerActionIntent,
): void {
  useGameStore.getState().setSubmittingAction(true);
  const normalized: PlayerActionIntent =
    action.kind === 'raise'
      ? { kind: 'raise', amount: Math.max(0, Math.round(action.amount)) }
      : action;
  socket?.emit(CLIENT_PLAYER_ACTION, { roomId, action: normalized });
}

export function onGameState(
  callback: (state: PlayerGameState) => void,
): () => void {
  gameStateListeners.add(callback);
  return () => {
    gameStateListeners.delete(callback);
  };
}

export function onHandResult(
  callback: (result: HandResultPayload) => void,
): () => void {
  handResultListeners.add(callback);
  return () => {
    handResultListeners.delete(callback);
  };
}

/** Test-only reset of the singleton socket client. */
export function resetSocketClientForTests(): void {
  disconnectSocket();
  useGameStore.getState().clearGameState();
}
