import type {
  AllowedRoomMaxSeats,
  CreateRoomResponse,
  GetRoomResponse,
} from '@neonpoker/shared';

import { apiFetch } from './http';

export async function createRoom(
  maxSeats?: AllowedRoomMaxSeats,
): Promise<CreateRoomResponse> {
  const body = maxSeats != null ? { maxSeats } : {};
  return apiFetch<CreateRoomResponse>('/rooms', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getRoom(roomIdOrCode: string): Promise<GetRoomResponse> {
  const encoded = encodeURIComponent(roomIdOrCode.trim());
  return apiFetch<GetRoomResponse>(`/rooms/${encoded}`);
}
