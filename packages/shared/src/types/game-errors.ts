import { ROOM_ERROR_CODES } from './room';

/** Socket/game error tokens emitted on `SERVER_ERROR`. */

export const GAME_ERROR_CODES = [
  'NOT_JOINED',
  'NOT_IN_HAND',
  'HAND_NOT_STARTED',
  'TABLE_NOT_FOUND',
  'NOT_ENOUGH_PLAYERS',
  'HAND_ALREADY_ACTIVE',
  'NOT_BUSTED',
  'HAND_IN_PROGRESS',
  'NEXT_HAND_NOT_WAITING',
  'NOT_ELIGIBLE_FOR_READY',
] as const;

export type GameErrorCode = (typeof GAME_ERROR_CODES)[number];

export const SOCKET_ERROR_CODES = [
  ...ROOM_ERROR_CODES,
  ...GAME_ERROR_CODES,
] as const;

export type SocketErrorCode = (typeof SOCKET_ERROR_CODES)[number];
