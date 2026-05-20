import { describe, expect, it } from 'vitest';

import { RoomStateSchema } from '@neonpoker/shared';

import { RoomService } from './room.service';

describe('RoomService membership (Phase 6B)', () => {
  const roomIds = {
    a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    c: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  };

  function testService(): RoomService {
    let seq = 0;
    return RoomService.forTest({
      code: () => {
        seq += 1;
        return `R${String(seq).padStart(5, '0')}`.slice(0, 6);
      },
      id: () => {
        const keys = Object.values(roomIds);
        return keys[seq++] ?? roomIds.a;
      },
    });
  }

  it('registers nickname and issues playerId', () => {
    const svc = testService();
    const result = svc.registerNickname('sock-a', { nickname: 'Neo_Player' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nickname).toBe('Neo_Player');
      expect(result.playerId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  it('rejects join before nickname registration', () => {
    const svc = testService();
    const room = svc.createRoom();

    const join = svc.joinRoom('sock-a', { roomId: room.roomId });
    expect(join).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Register nickname before joining a room',
    });
  });

  it('joins existing room by roomId and code', () => {
    const svc = testService();
    const room = svc.createRoom({ maxSeats: 6 });

    svc.registerNickname('sock-a', { nickname: 'Alpha' });
    const byId = svc.joinRoom('sock-a', { roomId: room.roomId });
    expect(byId).toEqual({ ok: true, roomId: room.roomId });

    svc.registerNickname('sock-b', { nickname: 'Beta' });
    const byCode = svc.joinRoom('sock-b', { roomId: room.code });
    expect(byCode.ok).toBe(true);

    const state = svc.getRoomState(room.roomId)!;
    expect(state.players).toHaveLength(2);
    expect(RoomStateSchema.parse(state).players.map((p) => p.nickname)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('returns ROOM_NOT_FOUND for missing room', () => {
    const svc = testService();
    svc.registerNickname('sock-a', { nickname: 'Ghost' });

    expect(svc.joinRoom('sock-a', { roomId: roomIds.a })).toEqual({
      ok: false,
      code: 'ROOM_NOT_FOUND',
      message: 'Room not found',
    });
  });

  it('rejects duplicate nickname in the same room (case-insensitive)', () => {
    const svc = testService();
    const room = svc.createRoom();

    svc.registerNickname('sock-a', { nickname: 'Player_One' });
    svc.joinRoom('sock-a', { roomId: room.roomId });

    svc.registerNickname('sock-b', { nickname: 'player_one' });
    expect(svc.joinRoom('sock-b', { roomId: room.roomId })).toEqual({
      ok: false,
      code: 'NICKNAME_TAKEN',
      message: 'Nickname already in use in this room',
    });
  });

  it('rejects ALREADY_JOINED for the same socket', () => {
    const svc = testService();
    const room = svc.createRoom();

    svc.registerNickname('sock-a', { nickname: 'Solo' });
    svc.joinRoom('sock-a', { roomId: room.roomId });

    expect(svc.joinRoom('sock-a', { roomId: room.roomId })).toEqual({
      ok: false,
      code: 'ALREADY_JOINED',
      message: 'Socket already joined this room',
    });
  });

  it('rejects ROOM_FULL when at capacity', () => {
    let seq = 0;
    const svc = RoomService.forTest({
      code: () => 'FULL01',
      id: () => roomIds.a,
    });

    const room = svc.createRoom({ maxSeats: 2 });

    for (const nick of ['Player_One', 'Player_Two', 'Player_Three']) {
      const sid = `sock-${seq++}`;
      svc.registerNickname(sid, { nickname: nick });
      const join = svc.joinRoom(sid, { roomId: room.roomId });
      if (nick === 'Player_Three') {
        expect(join).toEqual({
          ok: false,
          code: 'ROOM_FULL',
          message: 'Room is full',
        });
      } else {
        expect(join.ok).toBe(true);
      }
    }
  });

  it('leaveRoom removes player from roster', () => {
    const svc = testService();
    const room = svc.createRoom();

    svc.registerNickname('sock-a', { nickname: 'Leaver' });
    svc.joinRoom('sock-a', { roomId: room.roomId });

    const left = svc.leaveRoom('sock-a', {});
    expect(left).toEqual({ ok: true, roomId: room.roomId });
    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(0);
  });

  it('handleDisconnect removes player and clears session', () => {
    const svc = testService();
    const room = svc.createRoom();

    svc.registerNickname('sock-a', { nickname: 'Drop' });
    svc.joinRoom('sock-a', { roomId: room.roomId });

    const broadcastRoomId = svc.handleDisconnect('sock-a');
    expect(broadcastRoomId).toBe(room.roomId);
    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(0);
    expect(svc.getSession('sock-a')).toBeNull();
  });

  it('ROOM_STATE omits internal socket fields', () => {
    const svc = testService();
    const room = svc.createRoom();

    svc.registerNickname('sock-a', { nickname: 'Visible' });
    svc.joinRoom('sock-a', { roomId: room.roomId });

    const state = svc.getRoomState(room.roomId)!;
    expect(state).not.toHaveProperty('socketId');
    for (const p of state.players) {
      expect(p).not.toHaveProperty('socketId');
    }
    expect(RoomStateSchema.parse(state).roomId).toBe(room.roomId);
  });
});
