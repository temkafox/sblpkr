import { z } from 'zod';

import { ROOM_ERROR_CODES } from '../types/room';

const [firstRoomErrorCode, ...otherRoomErrorCodes] = ROOM_ERROR_CODES;

export const RoomErrorCodeSchema = z.enum([
  firstRoomErrorCode,
  ...otherRoomErrorCodes,
]);

export const ServerErrorPayloadSchema = z.object({
  code: RoomErrorCodeSchema,
  message: z.string().max(512).optional(),
});

export type ServerErrorPayload = z.infer<typeof ServerErrorPayloadSchema>;
