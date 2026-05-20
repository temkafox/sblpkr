import {
  CannotCallError,
  CannotCheckError,
  CannotRaiseError,
  InsufficientChipsError,
  InvalidActionError,
  InvalidTableStateError,
  NotEnoughPlayersError,
  OutOfTurnError,
  PokerCoreError,
  SeatNotFoundError,
  ShowdownNotReadyError,
} from '@neonpoker/poker-core';
import type { SocketErrorCode } from '@neonpoker/shared';

import { GameOrchestrationError } from './game.errors';

export function mapToSocketErrorCode(err: unknown): {
  code: SocketErrorCode;
  message: string;
} {
  if (err instanceof GameOrchestrationError) {
    return {
      code: err.code as SocketErrorCode,
      message: err.message,
    };
  }

  if (err instanceof OutOfTurnError) {
    return { code: 'NOT_YOUR_TURN', message: err.message };
  }

  if (err instanceof NotEnoughPlayersError) {
    return { code: 'NOT_ENOUGH_PLAYERS', message: err.message };
  }

  if (err instanceof InvalidTableStateError) {
    if (err.message.includes('No active hand')) {
      return { code: 'HAND_NOT_STARTED', message: err.message };
    }
    if (err.message.includes('active hand')) {
      return { code: 'HAND_ALREADY_ACTIVE', message: err.message };
    }
    return { code: 'INVALID_PAYLOAD', message: err.message };
  }

  if (
    err instanceof InvalidActionError ||
    err instanceof CannotCheckError ||
    err instanceof CannotCallError ||
    err instanceof CannotRaiseError ||
    err instanceof InsufficientChipsError ||
    err instanceof SeatNotFoundError ||
    err instanceof ShowdownNotReadyError
  ) {
    return { code: 'INVALID_PAYLOAD', message: err.message };
  }

  if (err instanceof PokerCoreError) {
    return { code: 'INVALID_PAYLOAD', message: err.message };
  }

  if (err instanceof Error) {
    return { code: 'INVALID_PAYLOAD', message: err.message };
  }

  return { code: 'INVALID_PAYLOAD', message: 'Unknown error' };
}
