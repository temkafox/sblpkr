import type {
  PlayerId,
  RoomMemberConnectionStatus,
  RoomStatus,
  SeatIndex,
} from '@neonpoker/shared';

/** Seated member tracked server-side (socket id never leaves the server). */

export type InternalSeatedPlayer = {
  playerId: PlayerId;
  nickname: string;
  seatIndex: SeatIndex | null;
  clientSessionId: string;
  socketId: string | null;
  connectionStatus: RoomMemberConnectionStatus;
  disconnectedAt?: number;
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
  clientSessionId: string;
  nickname: string | null;
  playerId: string | null;
  roomId: string | null;
};

export type DisconnectResult = {
  readonly roomId: string | null;
  /** When true, roster shrank and game reconciliation should run immediately. */
  readonly immediateRosterChange: boolean;
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
