import type { PlayerId, SeatIndex } from './player';

export type RoomId = string;

export type RoomCode = string;

export type RoomMemberConnectionStatus = 'connected' | 'disconnected';

export type RoomPlayer = {
  readonly playerId: PlayerId;
  readonly nickname: string;
  readonly seatIndex: SeatIndex | null;
  readonly connectionStatus: RoomMemberConnectionStatus;
};

export type RoomStatus = 'waiting' | 'playing' | 'closed';

export type RoomState = {
  readonly roomId: RoomId;
  readonly code: RoomCode;
  readonly maxSeats: number;
  readonly players: readonly RoomPlayer[];
  readonly status: RoomStatus;
};

/** Normalized server error tokens — extend alongside Nest gateway guards. */

export const ROOM_ERROR_CODES = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NICKNAME_TAKEN',
  'ALREADY_JOINED',
  'INVALID_PAYLOAD',
  'PROTOCOL_MISMATCH',
  'NOT_YOUR_TURN',
  'UNKNOWN_ROOM',
] as const;

export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

export type JoinRoomResult =
  | { readonly ok: true; readonly roomId: RoomId }
  | {
      readonly ok: false;
      readonly code: RoomErrorCode;
      readonly message?: string;
    };
