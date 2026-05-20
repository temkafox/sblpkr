import type { PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import { isActiveHand } from './gameStateAdapter';

/** Street / lobby label for the table header (uppercase). */
export function formatHandPhaseLabel(
  gameState: PlayerGameState | null | undefined,
): string {
  if (!isActiveHand(gameState)) {
    return 'WAITING';
  }
  const street = gameState!.street;
  if (street == null) {
    return 'WAITING';
  }
  return street;
}

/** Room code, occupancy, and hand phase for `table-page__room-meta`. */
export function formatRoomMetaLine(
  room: RoomStatePayload,
  gameState: PlayerGameState | null | undefined,
): string {
  const base = `${room.code} · ${room.players.length}/${room.maxSeats}`;
  const phase = formatHandPhaseLabel(gameState);
  if (!isActiveHand(gameState)) {
    return `${base} · ${phase} · waiting for hand`;
  }
  return `${base} · ${phase}`;
}
