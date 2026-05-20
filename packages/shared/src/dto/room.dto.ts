import { z } from 'zod';

import { PROTOCOL_VERSION } from '../protocol';

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
