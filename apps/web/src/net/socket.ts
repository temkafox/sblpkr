import {
  CLIENT_JOIN_ROOM,
  CLIENT_LEAVE_ROOM,
  CLIENT_PLAYER_ACTION,
  CLIENT_REGISTER_NICKNAME,
  CLIENT_REBUY,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_REQUEST_CHAT_MESSAGES,
  CLIENT_REQUEST_HAND_HISTORY,
  CLIENT_SEND_CHAT_MESSAGE,
  CLIENT_SET_NEXT_HAND_READY,
  CLIENT_START_HAND,
  SERVER_CHAT_MESSAGES,
  SERVER_ERROR,
  SERVER_GAME_STATE,
  SERVER_HAND_HISTORY,
  SERVER_HAND_RESULT,
  SERVER_NEXT_HAND_READY_STATE,
  SERVER_ROOM_STATE,
  SOCKET_IO_PATH,
} from '@neonpoker/shared';
import type {
  ChatMessage,
  HandHistoryPayload,
  HandResultPayload,
  PlayerActionIntent,
  PlayerGameState,
  RoomStatePayload,
  ServerErrorPayload,
} from '@neonpoker/shared';
import {
  ChatMessagesPayloadSchema,
  HandHistoryPayloadSchema,
  NextHandReadyStatePayloadSchema,
} from '@neonpoker/shared';
import { io, type Socket } from 'socket.io-client';

import {
  shouldAcceptGameStatePayload,
  shouldClearGameStateForRoom,
} from '../lib/gameStateRoster';
import { useChatStore } from '../state/chatStore';
import { useGameStore } from '../state/gameStore';
import { useRoomStore } from '../state/roomStore';
import {
  type ConnectionStatus,
  useSessionStore,
} from '../state/sessionStore';
import { getApiBaseUrl } from './http';

const JOIN_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 15_000;

let socket: Socket | null = null;
let listenersAttached = false;

const gameStateListeners = new Set<(state: PlayerGameState) => void>();
const handResultListeners = new Set<(result: HandResultPayload) => void>();
const chatMessagesListeners = new Set<(messages: ChatMessage[]) => void>();

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
    const prevRoomId = useRoomStore.getState().roomState?.roomId;
    useRoomStore.getState().setRoomState(payload);
    if (prevRoomId != null && prevRoomId !== payload.roomId) {
      useChatStore.getState().clearChatMessages();
    }
    if (
      shouldClearGameStateForRoom(
        payload,
        useGameStore.getState().gameState,
      )
    ) {
      useGameStore.getState().clearGameState();
      useGameStore.getState().clearHandHistory();
    }
    useGameStore.getState().setGameError(null);
    useGameStore.getState().setGameLoading(false);
    setConnectionStatus('connected');
  });

  client.on(SERVER_CHAT_MESSAGES, (payload: unknown) => {
    const parsed = ChatMessagesPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    const activeRoomId =
      useRoomStore.getState().roomState?.roomId ??
      useSessionStore.getState().roomId;
    if (activeRoomId != null && parsed.data.roomId !== activeRoomId) {
      return;
    }
    useChatStore.getState().setChatMessages(parsed.data.messages);
    for (const listener of chatMessagesListeners) {
      listener(parsed.data.messages);
    }
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

  client.on(SERVER_HAND_HISTORY, (payload: HandHistoryPayload) => {
    const parsed = HandHistoryPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    useGameStore.getState().setHandHistory(parsed.data);
  });

  client.on(SERVER_NEXT_HAND_READY_STATE, (payload: unknown) => {
    const parsed = NextHandReadyStatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    const activeRoomId =
      useRoomStore.getState().roomState?.roomId ??
      useSessionStore.getState().roomId;
    if (activeRoomId != null && parsed.data.roomId !== activeRoomId) {
      return;
    }
    useGameStore.getState().setNextHandReadyState(parsed.data);
  });

  client.on(SERVER_HAND_RESULT, (payload: HandResultPayload) => {
    const current = useGameStore.getState().gameState;
    if (
      current?.handId != null &&
      current.handId.length > 0 &&
      payload.handId !== current.handId
    ) {
      return;
    }
    useGameStore.getState().setHandResult(payload);
    useGameStore.getState().setSubmittingAction(false);
    for (const listener of handResultListeners) {
      listener(payload);
    }
  });

  client.on(SERVER_ERROR, (payload: ServerErrorPayload) => {
    useRoomStore.getState().setError(payload);
    useGameStore.getState().setGameError(payload.message ?? payload.code);
    useChatStore.getState().setChatError(payload.message ?? payload.code);
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

  if (socket) {
    disconnectSocket();
  }

  const baseUrl = getApiBaseUrl();
  setConnectionStatus('connecting');
  console.info('[neonpoker] socket connect', baseUrl, SOCKET_IO_PATH);

  return new Promise((resolve, reject) => {
    const client = io(baseUrl, {
      path: SOCKET_IO_PATH,
      transports: ['polling', 'websocket'],
      autoConnect: true,
    });
    socket = client;

    const onConnect = () => {
      cleanup();
      attachGlobalListeners(client);
      console.info('[neonpoker] socket connected');
      resolve(client);
    };

    const onConnectError = (err: Error) => {
      cleanup();
      socket = null;
      listenersAttached = false;
      setConnectionStatus('error');
      console.error('[neonpoker] socket connect_error', err);
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(connectTimer);
      client.off('connect', onConnect);
      client.off('connect_error', onConnectError);
    };

    const connectTimer = setTimeout(() => {
      cleanup();
      client.disconnect();
      socket = null;
      listenersAttached = false;
      setConnectionStatus('error');
      reject(new Error('Socket connection timed out'));
    }, CONNECT_TIMEOUT_MS);

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
  chatMessagesListeners.clear();
  useGameStore.getState().clearHandResult();
  useGameStore.getState().clearHandHistory();
  useChatStore.getState().clearChatMessages();
  setConnectionStatus('idle');
}

export function registerNickname(
  nickname: string,
  clientSessionId: string,
): void {
  socket?.emit(CLIENT_REGISTER_NICKNAME, { nickname, clientSessionId });
}

export function leaveRoom(roomId?: string): void {
  if (roomId) {
    socket?.emit(CLIENT_LEAVE_ROOM, { roomId });
  } else {
    socket?.emit(CLIENT_LEAVE_ROOM, {});
  }
  useGameStore.getState().clearHandResult();
  useGameStore.getState().clearHandHistory();
  useChatStore.getState().clearChatMessages();
}

export function joinRoom(
  roomId: string,
  clientSessionId: string,
): Promise<RoomStatePayload> {
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

    socket.emit(CLIENT_JOIN_ROOM, { roomId, clientSessionId });
  });
}

export function requestGameState(roomId: string): void {
  useGameStore.getState().setGameLoading(true);
  socket?.emit(CLIENT_REQUEST_GAME_STATE, { roomId });
}

export function requestHandHistory(roomId: string): void {
  socket?.emit(CLIENT_REQUEST_HAND_HISTORY, { roomId });
}

export function sendChatMessage(roomId: string, text: string): void {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return;
  }
  socket?.emit(CLIENT_SEND_CHAT_MESSAGE, { roomId, text: trimmed });
}

export function requestChatMessages(roomId: string): void {
  socket?.emit(CLIENT_REQUEST_CHAT_MESSAGES, { roomId });
}

export function onChatMessages(
  callback: (messages: ChatMessage[]) => void,
): () => void {
  chatMessagesListeners.add(callback);
  return () => {
    chatMessagesListeners.delete(callback);
  };
}

export function startHand(roomId: string): void {
  socket?.emit(CLIENT_START_HAND, { roomId });
}

export function setNextHandReady(roomId: string): void {
  socket?.emit(CLIENT_SET_NEXT_HAND_READY, { roomId });
}

export function rebuy(roomId: string): void {
  useGameStore.getState().setGameLoading(true);
  useGameStore.getState().setGameError(null);
  socket?.emit(CLIENT_REBUY, { roomId });
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
