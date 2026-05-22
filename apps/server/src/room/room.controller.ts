import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  CreateRoomRequestSchema,
  RoomIdOrCodeParamSchema,
} from '@neonpoker/shared';
import type { CreateRoomResponse, GetRoomResponse } from '@neonpoker/shared';

import {
  RoomInvalidPayloadHttpException,
  RoomNotFoundHttpException,
} from './room.errors';
import { RoomService } from './room.service';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  create(@Body() body: unknown): CreateRoomResponse {
    const parsed = CreateRoomRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues[0]?.message ?? 'Invalid request body';
      throw new RoomInvalidPayloadHttpException(detail);
    }

    try {
      return this.roomService.createRoom({ settings: parsed.data.settings });
    } catch (err) {
      const zodIssues =
        err != null &&
        typeof err === 'object' &&
        'issues' in err &&
        Array.isArray((err as { issues: unknown }).issues)
          ? (err as { issues: { message?: string }[] }).issues
          : null;
      if (zodIssues != null) {
        throw new RoomInvalidPayloadHttpException(
          zodIssues[0]?.message ?? 'Invalid room settings',
        );
      }
      throw err;
    }
  }

  @Get(':roomIdOrCode')
  getOne(@Param('roomIdOrCode') roomIdOrCode: string): GetRoomResponse {
    const param = RoomIdOrCodeParamSchema.safeParse(roomIdOrCode);
    if (!param.success) {
      throw new RoomInvalidPayloadHttpException(
        'roomIdOrCode must be a UUID room id or 6-character room code',
      );
    }

    const state = this.roomService.getRoomPublicState(param.data);
    if (state == null) {
      throw new RoomNotFoundHttpException();
    }

    return state;
  }
}
