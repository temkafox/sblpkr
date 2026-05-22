import { z } from 'zod';

import { PROTOCOL_VERSION } from '../protocol';
import type { RoomStatus } from '../types/room';
import {
  MaxSeatsSchema,
  RoomSettingsSchema,
  type RoomSettings,
} from './room-settings.dto';

/** Allowed table sizes for MVP room creation (REST Phase 6A). */

export const ALLOWED_ROOM_MAX_SEATS = [2, 4, 6, 9] as const;

export { MaxSeatsSchema };

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

export { RoomSettingsSchema, type RoomSettings } from './room-settings.dto';
export {
  DEFAULT_ROOM_SETTINGS,
  mergeRoomSettings,
} from './room-settings.dto';

export const CreateRoomRequestSchema = z.object({
  settings: z
    .object({
      roomName: z.string().trim().max(32).optional(),
      maxSeats: MaxSeatsSchema.optional(),
      startingStack: z.number().int().positive().optional(),
      smallBlind: z.number().int().min(1).optional(),
      bigBlind: z.number().int().min(1).optional(),
      rebuyAmount: z.number().int().positive().optional(),
      maxRebuysPerPlayer: z.number().int().nonnegative().nullable().optional(),
      actionTimeoutSeconds: z.number().int().min(5).max(120).optional(),
      disconnectGraceSeconds: z.number().int().min(5).max(120).optional(),
      allowSpectators: z.boolean().optional(),
      chatEnabled: z.boolean().optional(),
    })
    .optional(),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export type CreateRoomResponse = {
  readonly roomId: string;
  readonly code: string;
  readonly maxSeats: number;
  readonly status: RoomStatus;
  readonly seatedCount: number;
  readonly createdAt: string;
  readonly settings: RoomSettings;
};

export type GetRoomResponse = {
  readonly roomId: string;
  readonly code: string;
  readonly maxSeats: number;
  readonly status: RoomStatus;
  readonly seatedCount: number;
  readonly capacityAvailable: boolean;
  readonly settings: RoomSettings;
};

/** Matches Phase 1D nickname rules — duplicate enforcement stays server-side. */

export const ClientSessionIdSchema = z
  .string()
  .trim()
  .min(1, 'Client session id is required')
  .max(64, 'Client session id must be at most 64 characters');

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
  clientSessionId: ClientSessionIdSchema,
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
});

export type RegisterNicknamePayload = z.infer<
  typeof RegisterNicknamePayloadSchema
>;

export const JoinRoomPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
  clientSessionId: ClientSessionIdSchema,
});

export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const LeaveRoomPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128).optional(),
});

export type LeaveRoomPayload = z.infer<typeof LeaveRoomPayloadSchema>;

export const RoomMemberConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
]);

const RoomPlayerSchema = z.object({
  playerId: z.string().min(1),
  nickname: z.string().min(1),
  seatIndex: z.number().int().nonnegative().nullable(),
  connectionStatus: RoomMemberConnectionStatusSchema,
});

/** Wire snapshot broadcast on `SERVER_ROOM_STATE` (Phase 6B). */

export const RoomStateSchema = z.object({
  roomId: z.string().min(1),
  code: RoomCodeSchema,
  maxSeats: z.number().int().positive(),
  players: z.array(RoomPlayerSchema),
  status: z.enum(['waiting', 'playing', 'closed']),
  settings: RoomSettingsSchema,
});

export type RoomStatePayload = z.infer<typeof RoomStateSchema>;
