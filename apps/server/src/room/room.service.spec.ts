import { describe, expect, it } from 'vitest';

import { DEFAULT_ROOM_SETTINGS, ROOM_CODE_PATTERN } from '@neonpoker/shared';

import { RoomService } from './room.service';

describe('RoomService', () => {
  it('createRoom returns valid room code and roomId', () => {
    const svc = RoomService.forTest({
      code: () => 'ABC234',
      id: () => '11111111-1111-4111-8111-111111111111',
    });

    const created = svc.createRoom();

    expect(created.code).toMatch(ROOM_CODE_PATTERN);
    expect(created.roomId).toBe('11111111-1111-4111-8111-111111111111');
    expect(created.code).toBe('ABC234');
  });

  it('defaults maxSeats to 9', () => {
    const svc = RoomService.forTest({
      code: () => 'ROOM01',
      id: () => '22222222-2222-4222-8222-222222222222',
    });

    expect(svc.createRoom().maxSeats).toBe(9);
  });

  it('accepts allowed maxSeats values', () => {
    let seq = 0;
    const svc = RoomService.forTest({
      code: () => {
        seq += 1;
        return `S${String(seq).padStart(5, '0')}`.slice(0, 6);
      },
      id: () => {
        const suffix = String(seq).padStart(12, '0');
        return `33333333-3333-4333-8333-${suffix}`;
      },
    });

    for (const maxSeats of [2, 4, 6, 9] as const) {
      const room = svc.createRoom({ settings: { maxSeats } });
      expect(room.maxSeats).toBe(maxSeats);
    }
  });

  it('getRoom works by roomId and by code', () => {
    const svc = RoomService.forTest({
      code: () => 'JOINME',
      id: () => '44444444-4444-4444-8444-444444444444',
    });

    const created = svc.createRoom({ settings: { maxSeats: 6 } });

    expect(svc.getRoom(created.roomId)?.maxSeats).toBe(6);
    expect(svc.getRoom('joinme')?.roomId).toBe(created.roomId);
    expect(svc.getRoom('JOINME')?.roomId).toBe(created.roomId);
  });

  it('returns null for missing room', () => {
    const svc = RoomService.forTest();
    expect(svc.getRoom('ZZZZZZ')).toBeNull();
    expect(svc.getRoomPublicState('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('public state does not expose internal player array reference', () => {
    const svc = RoomService.forTest({
      code: () => 'PUBLIC',
      id: () => '55555555-5555-4555-8555-555555555555',
    });

    svc.createRoom();
    const pub = svc.getRoomPublicState('PUBLIC')!;

    expect(pub).not.toHaveProperty('players');
    expect(pub.seatedCount).toBe(0);
    expect(pub.capacityAvailable).toBe(true);
  });

  it('creating multiple rooms produces unique ids and codes', () => {
    let seq = 0;
    const svc = RoomService.forTest({
      code: () => {
        seq += 1;
        return `C${String(seq).padStart(5, '0')}`.slice(0, 6);
      },
      id: () => {
        const suffix = String(seq).padStart(12, '0');
        return `66666666-6666-4666-8666-${suffix}`;
      },
    });

    const a = svc.createRoom();
    const b = svc.createRoom();

    expect(a.roomId).not.toBe(b.roomId);
    expect(a.code).not.toBe(b.code);
  });

  it('stores merged settings on create', () => {
    const svc = RoomService.forTest({
      code: () => 'SETTNG',
      id: () => '88888888-8888-4888-8888-888888888888',
    });

    const created = svc.createRoom({
      settings: {
        startingStack: 500,
        smallBlind: 5,
        bigBlind: 10,
        rebuyAmount: 500,
        maxRebuysPerPlayer: 1,
        actionTimeoutSeconds: 10,
      },
    });

    const room = svc.getRoom(created.roomId)!;
    expect(room.settings.startingStack).toBe(500);
    expect(room.settings.smallBlind).toBe(5);
    expect(room.settings.bigBlind).toBe(10);
    expect(room.settings.maxRebuysPerPlayer).toBe(1);
    expect(room.settings.actionTimeoutSeconds).toBe(10);
    expect(created.settings.startingStack).toBe(500);
  });

  it('defaults settings when create payload omitted', () => {
    const svc = RoomService.forTest({
      code: () => 'DEFSET',
      id: () => '99999999-9999-4999-8999-999999999999',
    });
    const created = svc.createRoom();
    expect(created.settings).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it('deleteRoom removes room from lookup', () => {
    const svc = RoomService.forTest({
      code: () => 'DELETE',
      id: () => '77777777-7777-4777-8777-777777777777',
    });

    const created = svc.createRoom();
    expect(svc.roomExists(created.code)).toBe(true);
    expect(svc.deleteRoom(created.roomId)).toBe(true);
    expect(svc.roomExists(created.code)).toBe(false);
  });
});
