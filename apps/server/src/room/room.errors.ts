import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { RoomErrorCode } from '@neonpoker/shared';

export type RoomHttpErrorBody = {
  readonly code: RoomErrorCode;
  readonly message?: string;
};

export class RoomNotFoundHttpException extends NotFoundException {
  constructor(message = 'Room not found') {
    super({
      code: 'ROOM_NOT_FOUND' satisfies RoomErrorCode,
      message,
    } satisfies RoomHttpErrorBody);
  }
}

export class RoomInvalidPayloadHttpException extends BadRequestException {
  constructor(message = 'Invalid request payload') {
    super({
      code: 'INVALID_PAYLOAD' satisfies RoomErrorCode,
      message,
    } satisfies RoomHttpErrorBody);
  }
}
