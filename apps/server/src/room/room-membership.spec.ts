import { describe, expect, it, vi } from 'vitest';

import { RoomStateSchema } from '@neonpoker/shared';

import { DISCONNECT_GRACE_MS, RoomService } from './room.service';

function sessionId(label: string): string {
  return `client-session-${label}`;
}

function register(
  svc: RoomService,
  socketId: string,
  nickname: string,
  clientSessionId: string,
) {
  return svc.registerNickname(socketId, { nickname, clientSessionId });
}

function join(
  svc: RoomService,
  socketId: string,
  roomId: string,
  clientSessionId: string,
) {
  return svc.joinRoom(socketId, { roomId, clientSessionId });
}

describe('RoomService membership (Phase 6B)', () => {
  const roomIds = {
    a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    c: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  };

  function testService(
    options?: Parameters<typeof RoomService.forTest>[0],
  ): RoomService {
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
      ...options,
    });
  }

  it('registers nickname and issues playerId', () => {
    const svc = testService();
    const result = register(
      svc,
      'sock-a',
      'Neo_Player',
      sessionId('a'),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nickname).toBe('Neo_Player');
      expect(result.playerId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  it('reuses playerId for the same clientSessionId on re-register', () => {
    const svc = testService();
    const sid = sessionId('stable');
    const first = register(svc, 'sock-a', 'Neo_Player', sid);
    const second = register(svc, 'sock-b', 'Neo_Player', sid);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.playerId).toBe(first.playerId);
    }
  });

  it('rejects join before nickname registration', () => {
    const svc = testService();
    const room = svc.createRoom();

    const joinResult = join(svc, 'sock-a', room.roomId, sessionId('a'));
    expect(joinResult).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Register nickname before joining a room',
    });
  });

  it('joins existing room by roomId and code', () => {
    const svc = testService();
    const room = svc.createRoom({ settings: { maxSeats: 6 } });

    register(svc, 'sock-a', 'Alpha', sessionId('a'));
    const byId = join(svc, 'sock-a', room.roomId, sessionId('a'));
    expect(byId).toEqual({ ok: true, roomId: room.roomId });

    register(svc, 'sock-b', 'Beta', sessionId('b'));
    const byCode = join(svc, 'sock-b', room.code, sessionId('b'));
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
    register(svc, 'sock-a', 'Ghost', sessionId('a'));

    expect(join(svc, 'sock-a', roomIds.a, sessionId('a'))).toEqual({
      ok: false,
      code: 'ROOM_NOT_FOUND',
      message: 'Room not found',
    });
  });

  it('rejects duplicate nickname in the same room (case-insensitive)', () => {
    const svc = testService();
    const room = svc.createRoom();

    register(svc, 'sock-a', 'Player_One', sessionId('a'));
    join(svc, 'sock-a', room.roomId, sessionId('a'));

    register(svc, 'sock-b', 'player_one', sessionId('b'));
    expect(join(svc, 'sock-b', room.roomId, sessionId('b'))).toEqual({
      ok: false,
      code: 'NICKNAME_TAKEN',
      message: 'Nickname already in use in this room',
    });
  });

  it('rejects ALREADY_JOINED for the same socket', () => {
    const svc = testService();
    const room = svc.createRoom();
    const sid = sessionId('solo');

    register(svc, 'sock-a', 'Solo', sid);
    join(svc, 'sock-a', room.roomId, sid);

    expect(join(svc, 'sock-a', room.roomId, sid)).toEqual({
      ok: false,
      code: 'ALREADY_JOINED',
      message: 'Socket already joined this room',
    });
  });

  it('rejects ROOM_FULL when at capacity', () => {
    const svc = RoomService.forTest({
      code: () => 'FULL01',
      id: () => roomIds.a,
    });

    const room = svc.createRoom({ settings: { maxSeats: 2 } });

    for (const nick of ['Player_One', 'Player_Two', 'Player_Three']) {
      const sid = sessionId(nick);
      const socket = `sock-${nick}`;
      register(svc, socket, nick, sid);
      const joinResult = join(svc, socket, room.roomId, sid);
      if (nick === 'Player_Three') {
        expect(joinResult).toEqual({
          ok: false,
          code: 'ROOM_FULL',
          message: 'Room is full',
        });
      } else {
        expect(joinResult.ok).toBe(true);
      }
    }
  });

  it('leaveRoom removes player from roster immediately', () => {
    const svc = testService();
    const room = svc.createRoom();
    const sid = sessionId('leaver');

    register(svc, 'sock-a', 'Leaver', sid);
    join(svc, 'sock-a', room.roomId, sid);

    const left = svc.leaveRoom('sock-a', {});
    expect(left).toEqual({ ok: true, roomId: room.roomId });
    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(0);
  });

  it('handleDisconnect marks player disconnected in room state', () => {
    const svc = testService({ gracePeriodMs: 60_000 });
    const room = svc.createRoom();
    const sid = sessionId('away-mark');

    register(svc, 'sock-a', 'Away', sid);
    join(svc, 'sock-a', room.roomId, sid);

    svc.handleDisconnect('sock-a');
    const state = svc.getRoomState(room.roomId)!;
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.connectionStatus).toBe('disconnected');
    expect(state.players[0]).not.toHaveProperty('socketId');
  });

  it('reconnect clears disconnected status', () => {
    const svc = testService({ gracePeriodMs: 1_000 });
    const room = svc.createRoom();
    const clientSid = sessionId('away-clear');

    register(svc, 'sock-a', 'Away', clientSid);
    join(svc, 'sock-a', room.roomId, clientSid);
    svc.handleDisconnect('sock-a');

    register(svc, 'sock-b', 'Away', clientSid);
    join(svc, 'sock-b', room.roomId, clientSid);

    const state = svc.getRoomState(room.roomId)!;
    expect(state.players[0]?.connectionStatus).toBe('connected');
  });

  it('handleDisconnect keeps player during grace period', () => {
    const svc = testService({ gracePeriodMs: 60_000 });
    const room = svc.createRoom();
    const sid = sessionId('drop');

    register(svc, 'sock-a', 'Drop', sid);
    join(svc, 'sock-a', room.roomId, sid);

    const result = svc.handleDisconnect('sock-a');
    expect(result).toEqual({
      roomId: room.roomId,
      immediateRosterChange: false,
    });
    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(1);
    expect(svc.getSession('sock-a')).toBeNull();
  });

  it('ROOM_STATE omits internal socket fields', () => {
    const svc = testService();
    const room = svc.createRoom();
    const sid = sessionId('visible');

    register(svc, 'sock-a', 'Visible', sid);
    join(svc, 'sock-a', room.roomId, sid);

    const state = svc.getRoomState(room.roomId)!;
    expect(state).not.toHaveProperty('socketId');
    for (const p of state.players) {
      expect(p).not.toHaveProperty('socketId');
    }
    expect(RoomStateSchema.parse(state).roomId).toBe(room.roomId);
  });
});

describe('RoomService reconnect (F5)', () => {
  const roomId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  function svcWithGrace(
    onGraceExpired?: (roomId: string) => void,
  ): RoomService {
    return RoomService.forTest({
      code: () => 'RCON01',
      id: () => roomId,
      gracePeriodMs: 1_000,
      onGraceExpired,
    });
  }

  it('reconnect with same clientSessionId keeps playerId and seat', () => {
    const svc = svcWithGrace();
    const room = svc.createRoom({ settings: { maxSeats: 6 } });
    const clientSid = 'session-alpha';

    register(svc, 'sock-a', 'Alpha', clientSid);
    join(svc, 'sock-a', room.roomId, clientSid);
    const first = svc.getRoomState(room.roomId)!.players[0]!;

    svc.handleDisconnect('sock-a');

    register(svc, 'sock-b', 'Alpha', clientSid);
    const rejoin = join(svc, 'sock-b', room.roomId, clientSid);
    expect(rejoin).toEqual({ ok: true, roomId: room.roomId });

    const state = svc.getRoomState(room.roomId)!;
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.playerId).toBe(first.playerId);
    expect(state.players[0]?.seatIndex).toBe(first.seatIndex);
  });

  it('reconnect does not duplicate player in room', () => {
    const svc = svcWithGrace();
    const room = svc.createRoom();
    const clientSid = 'session-beta';

    register(svc, 'sock-a', 'Beta', clientSid);
    join(svc, 'sock-a', room.roomId, clientSid);
    svc.handleDisconnect('sock-a');

    register(svc, 'sock-b', 'Beta', clientSid);
    join(svc, 'sock-b', room.roomId, clientSid);

    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(1);
  });

  it('removes disconnected player after grace timeout', () => {
    vi.useFakeTimers();
    const graceCalls: string[] = [];
    const svc = svcWithGrace((id) => graceCalls.push(id));
    const room = svc.createRoom();
    const clientSid = 'session-gamma';

    register(svc, 'sock-a', 'Gamma', clientSid);
    join(svc, 'sock-a', room.roomId, clientSid);
    svc.handleDisconnect('sock-a');

    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(1);

    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 50);

    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(0);
    expect(graceCalls).toEqual([room.roomId]);
    vi.useRealTimers();
  });

  it('cancel grace when player reconnects in time', () => {
    vi.useFakeTimers();
    const graceCalls: string[] = [];
    const svc = svcWithGrace((id) => graceCalls.push(id));
    const room = svc.createRoom();
    const clientSid = 'session-delta';

    register(svc, 'sock-a', 'Delta', clientSid);
    join(svc, 'sock-a', room.roomId, clientSid);
    svc.handleDisconnect('sock-a');

    register(svc, 'sock-b', 'Delta', clientSid);
    join(svc, 'sock-b', room.roomId, clientSid);

    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 50);

    expect(svc.getRoomState(room.roomId)!.players).toHaveLength(1);
    expect(graceCalls).toHaveLength(0);
    vi.useRealTimers();
  });
});
