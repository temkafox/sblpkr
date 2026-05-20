import { z } from 'zod';

import { SOCKET_ERROR_CODES } from '../types/game-errors';

const [firstErrorCode, ...otherErrorCodes] = SOCKET_ERROR_CODES;

export const SocketErrorCodeSchema = z.enum([
  firstErrorCode,
  ...otherErrorCodes,
]);

/** @deprecated Use {@link SocketErrorCodeSchema} — kept for room-only imports. */
export const RoomErrorCodeSchema = SocketErrorCodeSchema;

export const ServerErrorPayloadSchema = z.object({
  code: SocketErrorCodeSchema,
  message: z.string().max(512).optional(),
});

export type ServerErrorPayload = z.infer<typeof ServerErrorPayloadSchema>;
