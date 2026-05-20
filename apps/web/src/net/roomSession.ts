import type { GetRoomResponse } from '@neonpoker/shared';

import { getRoom } from './roomsApi';
import {
  connectSocket,
  joinRoom,
  registerNickname,
} from './socket';
import { useRoomStore } from '../state/roomStore';
import { useSessionStore } from '../state/sessionStore';

export type EstablishRoomSessionResult = {
  room: GetRoomResponse;
  roomId: string;
};

/** REST lookup, socket connect, nickname registration, and room join. */
export async function establishRoomSession(
  nickname: string,
  roomLookup: string,
): Promise<EstablishRoomSessionResult> {
  useRoomStore.getState().clearRoomState();
  useSessionStore.getState().setConnectionStatus('connecting');

  const room = await getRoom(roomLookup);
  await connectSocket();
  registerNickname(nickname);
  await joinRoom(room.roomId);

  useSessionStore.getState().setSession({
    nickname,
    roomId: room.roomId,
  });

  return { room, roomId: room.roomId };
}
