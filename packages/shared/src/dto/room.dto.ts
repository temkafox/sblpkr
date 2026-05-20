import { z } from 'zod';

import { PROTOCOL_VERSION } from '../protocol';
import type { RoomStatus } from '../types/room';

/** Allowed table sizes for MVP room creation (REST Phase 6A). */

export const ALLOWED_ROOM_MAX_SEATS = [2, 4, 6, 9] as const;

export const MaxSeatsSchema = z.union([
  z.literal(2),
  z.literal(4),
  z.literal(6),
  z.literal(9),
]);

export type AllowedRoomMaxSeats = z.infer<typeof MaxSeatsSchema>;

/** Shareable invite code — 6 uppercase alphanumeric (no ambiguous chars enforced server-side). */

export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ROOM_CODE_PATTERN, 'Room code must be 6 uppercase alphanumeric characters');

export const RoomIdSchema = z.string().uuid();

/** Path param for `GET /rooms/:roomIdOrCode`. */

export const RoomIdOrCodeParamSchema = z.union([RoomIdSchema, RoomCodeSchema]);

export const CreateRoomRequestSchema = z.object({
  maxSeats: MaxSeatsSchema.optional(),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export type CreateRoomResponse = {
  readonly roomId: string;
  readonly code: string;
  readonly maxSeats: number;
  readonly status: RoomStatus;
  readonly seatedCount: number;
  readonly createdAt: string;
};

export type GetRoomResponse = {
  readonly roomId: string;
  readonly code: string;
  readonly maxSeats: number;
  readonly status: RoomStatus;
  readonly seatedCount: number;
  readonly capacityAvailable: boolean;
};

/** Matches Phase 1D nickname rules — duplicate enforcement stays server-side. */

export const RegisterNicknamePayloadSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(3, 'Nickname must be at least 3 characters')
    .max(20, 'Nickname must be at most 20 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Nickname may contain letters, numbers, underscore, or hyphen only',
    ),
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
});

export type RegisterNicknamePayload = z.infer<
  typeof RegisterNicknamePayloadSchema
>;

export const JoinRoomPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const LeaveRoomPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128).optional(),
});

export type LeaveRoomPayload = z.infer<typeof LeaveRoomPayloadSchema>;
