import type { GetRoomResponse } from '@neonpoker/shared';

import { getOrCreateClientSessionId } from '../lib/clientSession';
import { ensureRoomStateSettings } from '../lib/roomSettingsForm';
import { getRoom } from './roomsApi';
import {
  connectSocket,
  joinRoom,
  registerNickname,
  requestChatMessages,
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

/** Merge REST metadata without replacing roster from SERVER_ROOM_STATE. */
function patchRoomSettingsFromRest(room: GetRoomResponse): void {
  const current = useRoomStore.getState().roomState;
  if (current == null || current.roomId !== room.roomId) {
    return;
  }

  useRoomStore.getState().setRoomState(
    ensureRoomStateSettings({
      ...current,
      code: room.code,
      maxSeats: room.maxSeats,
      status: room.status,
      settings: room.settings,
    }),
  );
}

/** REST lookup, socket connect, nickname registration, and room join (first visit). */
export async function establishRoomSession(
  nickname: string,
  roomLookup: string,
): Promise<EstablishRoomSessionResult> {
  useRoomStore.getState().clearRoomState();
  useGameStore.getState().clearGameState();
  useSessionStore.getState().setConnectionStatus('connecting');

  const clientSessionId = getOrCreateClientSessionId();
  console.info('[neonpoker] getRoom', roomLookup);
  const room = await getRoom(roomLookup);
  console.info('[neonpoker] getRoom ok', room.roomId);
  await connectSocket();
  registerNickname(nickname, clientSessionId);
  await joinRoom(room.roomId, clientSessionId);

  useSessionStore.getState().setSession({
    nickname,
    roomId: room.roomId,
  });

  patchRoomSettingsFromRest(room);

  requestGameState(room.roomId);
  requestHandHistory(room.roomId);
  requestChatMessages(room.roomId);

  return { room, roomId: room.roomId };
}

/** F5 / socket reconnect — preserves in-memory client game state until server responds. */
export async function reconnectRoomSession(
  nickname: string,
  roomLookup: string,
): Promise<EstablishRoomSessionResult> {
  useSessionStore.getState().setConnectionStatus('connecting');

  const clientSessionId = getOrCreateClientSessionId();
  console.info('[neonpoker] getRoom', roomLookup);
  const room = await getRoom(roomLookup);
  console.info('[neonpoker] getRoom ok', room.roomId);
  await connectSocket();
  registerNickname(nickname, clientSessionId);
  await joinRoom(room.roomId, clientSessionId);

  useSessionStore.getState().setSession({
    nickname,
    roomId: room.roomId,
  });

  patchRoomSettingsFromRest(room);

  requestGameState(room.roomId);
  requestHandHistory(room.roomId);
  requestChatMessages(room.roomId);

  return { room, roomId: room.roomId };
}
