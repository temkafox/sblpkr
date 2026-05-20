import { describe, expect, it, vi } from 'vitest';

import type { CreateRoomResponse, GetRoomResponse } from '@neonpoker/shared';

import { RoomController } from './room.controller';
import {
  RoomInvalidPayloadHttpException,
  RoomNotFoundHttpException,
} from './room.errors';
import { RoomService } from './room.service';

describe('RoomController', () => {
  const sampleCreate: CreateRoomResponse = {
    roomId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    code: 'TEST01',
    maxSeats: 9,
    status: 'waiting',
    seatedCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const sampleGet: GetRoomResponse = {
    roomId: sampleCreate.roomId,
    code: sampleCreate.code,
    maxSeats: 9,
    status: 'waiting',
    seatedCount: 0,
    capacityAvailable: true,
  };

  it('POST create delegates to RoomService', () => {
    const createRoom = vi.fn().mockReturnValue(sampleCreate);
    const svc = { createRoom } as unknown as RoomService;
    const controller = new RoomController(svc);

    const body = controller.create({ maxSeats: 6 });

    expect(createRoom).toHaveBeenCalledWith({ maxSeats: 6 });
    expect(body).toEqual(sampleCreate);
  });

  it('POST create rejects invalid maxSeats', () => {
    const controller = new RoomController(
      RoomService.forTest({
        code: () => 'BAD001',
        id: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    );

    expect(() => controller.create({ maxSeats: 5 })).toThrow(
      RoomInvalidPayloadHttpException,
    );
  });

  it('GET returns public room state', () => {
    const getRoomPublicState = vi.fn().mockReturnValue(sampleGet);
    const svc = { getRoomPublicState } as unknown as RoomService;
    const controller = new RoomController(svc);

    expect(controller.getOne(sampleCreate.code)).toEqual(sampleGet);
    expect(getRoomPublicState).toHaveBeenCalledWith(sampleGet.code);
  });

  it('GET rejects invalid room id/code shape', () => {
    const controller = new RoomController(RoomService.forTest());

    expect(() => controller.getOne('not-valid')).toThrow(
      RoomInvalidPayloadHttpException,
    );
  });

  it('GET throws ROOM_NOT_FOUND when missing', () => {
    const controller = new RoomController(
      RoomService.forTest({
        code: () => 'GHOST1',
        id: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    );

    expect(() => controller.getOne('GHOST1')).toThrow(RoomNotFoundHttpException);
  });
});
