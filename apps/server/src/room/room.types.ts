import type { RoomPlayer, RoomStatus } from '@neonpoker/shared';

/** Seated member tracked server-side (socket id never leaves the server). */

export type InternalSeatedPlayer = RoomPlayer & {
  readonly socketId: string;
};

/** In-memory room record — mutable `players` while membership changes. */

export type MutableInternalRoom = {
  roomId: string;
  code: string;
  createdAt: Date;
  maxSeats: number;
  status: RoomStatus;
  players: InternalSeatedPlayer[];
  hostPlayerId: string | null;
};

export type SocketSession = {
  socketId: string;
  nickname: string | null;
  playerId: string | null;
  roomId: string | null;
};

export type CreateRoomOptions = {
  readonly maxSeats?: 2 | 4 | 6 | 9;
};

export type RoomCodeGenerator = () => string;

export type RoomIdGenerator = () => string;

export type RegisterNicknameResult =
  | { readonly ok: true; readonly playerId: string; readonly nickname: string }
  | {
      readonly ok: false;
      readonly code: 'INVALID_PAYLOAD' | 'PROTOCOL_MISMATCH';
      readonly message?: string;
    };

export type LeaveRoomResult =
  | { readonly ok: true; readonly roomId: string | null }
  | {
      readonly ok: false;
      readonly code: 'INVALID_PAYLOAD' | 'ROOM_NOT_FOUND';
      readonly message?: string;
    };
