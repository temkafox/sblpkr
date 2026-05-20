import type { SocketErrorCode } from '@neonpoker/shared';

import { HttpError } from './http';
import { SocketRoomError } from './socket';

const SOCKET_ERROR_MESSAGES: Partial<Record<SocketErrorCode, string>> = {
  ROOM_NOT_FOUND: 'Room not found.',
  ROOM_FULL: 'This room is full.',
  NICKNAME_TAKEN: 'That nickname is already taken in this room.',
  ALREADY_JOINED: 'You are already in this room.',
  INVALID_PAYLOAD: 'Invalid request. Check your nickname and room code.',
  PROTOCOL_MISMATCH: 'Client version is not supported.',
};

export function messageForSocketErrorCode(code: string): string {
  return (
    SOCKET_ERROR_MESSAGES[code as SocketErrorCode] ??
    'Could not join the room. Please try again.'
  );
}

export function formatJoinError(err: unknown): string {
  if (err instanceof SocketRoomError) {
    return err.serverMessage ?? messageForSocketErrorCode(err.code);
  }

  if (err instanceof HttpError) {
    if (err.code) {
      return messageForSocketErrorCode(err.code);
    }
    if (err.status === 404) {
      return messageForSocketErrorCode('ROOM_NOT_FOUND');
    }
    if (err.status >= 500) {
      return 'Server is unavailable. Try again shortly.';
    }
    return err.message;
  }

  if (err instanceof TypeError) {
    return 'Unable to reach the server. Is it running?';
  }

  if (err instanceof Error && err.message === 'Join timed out') {
    return 'Join timed out. Check your connection and try again.';
  }

  return 'Something went wrong. Please try again.';
}
