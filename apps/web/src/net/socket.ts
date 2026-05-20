import {
  CLIENT_JOIN_ROOM,
  CLIENT_LEAVE_ROOM,
  CLIENT_REGISTER_NICKNAME,
  SERVER_ERROR,
  SERVER_ROOM_STATE,
} from '@neonpoker/shared';
import type { RoomStatePayload, ServerErrorPayload } from '@neonpoker/shared';
import { io, type Socket } from 'socket.io-client';

import { useRoomStore } from '../state/roomStore';
import {
  type ConnectionStatus,
  useSessionStore,
} from '../state/sessionStore';
import { getApiBaseUrl } from './http';

const JOIN_TIMEOUT_MS = 8_000;

let socket: Socket | null = null;
let listenersAttached = false;

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
    setConnectionStatus('connected');
  });

  client.on(SERVER_ERROR, (payload: ServerErrorPayload) => {
    useRoomStore.getState().setError(payload);
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

/** Test-only reset of the singleton socket client. */
export function resetSocketClientForTests(): void {
  disconnectSocket();
}
