export type GameErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'TABLE_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_ACTIVE_HAND'
  | 'HAND_ALREADY_ACTIVE';

export class GameOrchestrationError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameOrchestrationError';
    this.code = code;
  }
}
