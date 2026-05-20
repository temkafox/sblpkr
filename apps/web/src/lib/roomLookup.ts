import { ROOM_CODE_PATTERN, RoomIdSchema } from '@neonpoker/shared';

import { normalizeRoomCode } from './roomCode';

/** Room id (UUID) or 6-character server room code for REST/socket lookup. */
export function resolveRoomLookupParam(input: string): string {
  const trimmed = input.trim();
  if (RoomIdSchema.safeParse(trimmed).success) {
    return trimmed;
  }
  return normalizeRoomCode(trimmed);
}

export function isValidRoomLookup(input: string): boolean {
  const trimmed = input.trim();
  if (RoomIdSchema.safeParse(trimmed).success) {
    return true;
  }
  const code = normalizeRoomCode(trimmed);
  return ROOM_CODE_PATTERN.test(code);
}
