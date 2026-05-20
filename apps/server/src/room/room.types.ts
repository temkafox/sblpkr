import type { RoomPlayer, RoomStatus } from '@neonpoker/shared';

/** In-memory room record — server-only; never returned verbatim to clients. */

export type InternalRoom = {
  readonly roomId: string;
  readonly code: string;
  readonly createdAt: Date;
  readonly maxSeats: number;
  readonly status: RoomStatus;
  readonly players: readonly RoomPlayer[];
  readonly hostPlayerId: string | null;
};

export type CreateRoomOptions = {
  readonly maxSeats?: 2 | 4 | 6 | 9;
};

export type RoomCodeGenerator = () => string;

export type RoomIdGenerator = () => string;
