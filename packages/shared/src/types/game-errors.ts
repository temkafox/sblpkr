import { ROOM_ERROR_CODES } from './room';

/** Socket/game error tokens emitted on `SERVER_ERROR`. */

export const GAME_ERROR_CODES = [
  'NOT_JOINED',
  'HAND_NOT_STARTED',
  'TABLE_NOT_FOUND',
  'NOT_ENOUGH_PLAYERS',
  'HAND_ALREADY_ACTIVE',
] as const;

export type GameErrorCode = (typeof GAME_ERROR_CODES)[number];

export const SOCKET_ERROR_CODES = [
  ...ROOM_ERROR_CODES,
  ...GAME_ERROR_CODES,
] as const;

export type SocketErrorCode = (typeof SOCKET_ERROR_CODES)[number];
