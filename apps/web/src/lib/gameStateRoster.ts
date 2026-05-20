import type { PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import { isActiveHand } from './gameStateAdapter';

const MIN_PLAYERS_FOR_HAND = 2;

/** True when every occupied seat playerId is still in the room roster. */
export function gameStateMatchesRoomRoster(
  state: PlayerGameState,
  room: RoomStatePayload,
): boolean {
  const rosterIds = new Set(room.players.map((p) => p.playerId));
  for (const seat of state.seats) {
    if (seat.playerId == null) continue;
    if (!rosterIds.has(seat.playerId)) {
      return false;
    }
  }
  return true;
}

/** Whether the client should drop cached game state for this room update. */
export function shouldClearGameStateForRoom(
  room: RoomStatePayload,
  gameState: PlayerGameState | null | undefined,
): boolean {
  if (room.players.length < MIN_PLAYERS_FOR_HAND) {
    return true;
  }
  if (gameState == null) {
    return false;
  }
  if (isActiveHand(gameState) && !gameStateMatchesRoomRoster(gameState, room)) {
    return true;
  }
  return false;
}

/** Reject stale active-hand payloads that no longer match roster or headcount. */
export function shouldAcceptGameStatePayload(
  payload: PlayerGameState,
  room: RoomStatePayload | null,
): boolean {
  if (room == null) {
    return true;
  }
  if (room.players.length < MIN_PLAYERS_FOR_HAND && isActiveHand(payload)) {
    return false;
  }
  if (isActiveHand(payload) && !gameStateMatchesRoomRoster(payload, room)) {
    return false;
  }
  return true;
}
