export type GameErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'TABLE_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_ACTIVE_HAND'
  | 'HAND_ALREADY_ACTIVE'
  | 'NOT_JOINED'
  | 'NOT_BUSTED'
  | 'HAND_IN_PROGRESS'
  | 'REBUY_DISABLED'
  | 'REBUY_LIMIT_REACHED'
  | 'NEXT_HAND_NOT_WAITING'
  | 'NOT_ELIGIBLE_FOR_READY';

export class GameOrchestrationError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameOrchestrationError';
    this.code = code;
  }
}
