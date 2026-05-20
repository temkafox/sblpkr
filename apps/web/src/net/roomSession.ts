import type { GetRoomResponse } from '@neonpoker/shared';

import { getOrCreateClientSessionId } from '../lib/clientSession';
import { getRoom } from './roomsApi';
import {
  connectSocket,
  joinRoom,
  registerNickname,
  requestGameState,
  requestHandHistory,
} from './socket';
import { useGameStore } from '../state/gameStore';
import { useRoomStore } from '../state/roomStore';
import { useSessionStore } from '../state/sessionStore';

export type EstablishRoomSessionResult = {
  room: GetRoomResponse;
  roomId: string;
};

/** REST lookup, socket connect, nickname registration, and room join (first visit). */
export async function establishRoomSession(
  nickname: string,
  roomLookup: string,
): Promise<EstablishRoomSessionResult> {
  useRoomStore.getState().clearRoomState();
  useGameStore.getState().clearGameState();
  useSessionStore.getState().setConnectionStatus('connecting');

  const clientSessionId = getOrCreateClientSessionId();
  const room = await getRoom(roomLookup);
  await connectSocket();
  registerNickname(nickname, clientSessionId);
  await joinRoom(room.roomId, clientSessionId);

  useSessionStore.getState().setSession({
    nickname,
    roomId: room.roomId,
  });

  requestGameState(room.roomId);
  requestHandHistory(room.roomId);

  return { room, roomId: room.roomId };
}

/** F5 / socket reconnect — preserves in-memory client game state until server responds. */
export async function reconnectRoomSession(
  nickname: string,
  roomLookup: string,
): Promise<EstablishRoomSessionResult> {
  useSessionStore.getState().setConnectionStatus('connecting');

  const clientSessionId = getOrCreateClientSessionId();
  const room = await getRoom(roomLookup);
  await connectSocket();
  registerNickname(nickname, clientSessionId);
  await joinRoom(room.roomId, clientSessionId);

  useSessionStore.getState().setSession({
    nickname,
    roomId: room.roomId,
  });

  requestGameState(room.roomId);
  requestHandHistory(room.roomId);

  return { room, roomId: room.roomId };
}
