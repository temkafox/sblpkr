import type {
  CreateRoomResponse,
  GetRoomResponse,
  RoomSettingsPartial,
} from '@neonpoker/shared';

import { apiFetch } from './http';

export async function createRoom(
  settings?: RoomSettingsPartial,
): Promise<CreateRoomResponse> {
  const body = settings != null ? { settings } : {};
  return apiFetch<CreateRoomResponse>('/rooms', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getRoom(roomIdOrCode: string): Promise<GetRoomResponse> {
  const encoded = encodeURIComponent(roomIdOrCode.trim());
  return apiFetch<GetRoomResponse>(`/rooms/${encoded}`);
}
