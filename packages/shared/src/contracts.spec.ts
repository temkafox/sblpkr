import { describe, expect, it } from 'vitest';

import {
  ChatMessagePayloadSchema,
  ClientHelloSchema,
  CreateRoomRequestSchema,
  HandResultPayloadSchema,
  JoinRoomPayloadSchema,
  RoomStateSchema,
  PlayerActionPayloadSchema,
  PROTOCOL_VERSION,
  RegisterNicknamePayloadSchema,
  RoomCodeSchema,
  RoomIdOrCodeParamSchema,
  ServerErrorPayloadSchema,
  SOCKET_EVENTS,
} from './index';

describe('RegisterNicknamePayloadSchema', () => {
  it('accepts valid nicknames', () => {
    const parsed = RegisterNicknamePayloadSchema.parse({
      nickname: 'Neo_Player',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(parsed.nickname).toBe('Neo_Player');
  });

  it('trims nickname', () => {
    const parsed = RegisterNicknamePayloadSchema.parse({
      nickname: '  valid_name  ',
    });
    expect(parsed.nickname).toBe('valid_name');
  });

  it('rejects invalid characters', () => {
    expect(() =>
      RegisterNicknamePayloadSchema.parse({ nickname: 'no spaces' }),
    ).toThrow();
  });

  it('rejects short nicknames', () => {
    expect(() =>
      RegisterNicknamePayloadSchema.parse({ nickname: 'ab' }),
    ).toThrow();
  });
});

describe('JoinRoomPayloadSchema', () => {
  it('requires non-empty trimmed room id', () => {
    expect(() =>
      JoinRoomPayloadSchema.parse({ roomId: 'ROOM1234' }),
    ).not.toThrow();
    expect(() => JoinRoomPayloadSchema.parse({ roomId: '' })).toThrow();
    expect(() => JoinRoomPayloadSchema.parse({ roomId: '   ' })).toThrow();
  });
});

describe('PlayerActionPayloadSchema', () => {
  it('parses fold intent', () => {
    const out = PlayerActionPayloadSchema.parse({
      roomId: 'room-1',
      action: { kind: 'fold' },
    });
    expect(out.action.kind).toBe('fold');
  });

  it('parses raise with integer amount', () => {
    const out = PlayerActionPayloadSchema.parse({
      roomId: 'room-1',
      action: { kind: 'raise', amount: 50 },
    });
    expect(out.action).toEqual({ kind: 'raise', amount: 50 });
  });

  it('rejects fractional raise amount', () => {
    expect(() =>
      PlayerActionPayloadSchema.parse({
        roomId: 'room-1',
        action: { kind: 'raise', amount: 50.5 },
      }),
    ).toThrow();
  });

  it('rejects unknown kind', () => {
    expect(() =>
      PlayerActionPayloadSchema.parse({
        roomId: 'room-1',
        action: { kind: 'donate' },
      }),
    ).toThrow();
  });
});

describe('HandResultPayloadSchema', () => {
  it('parses extended hand result payload', () => {
    const parsed = HandResultPayloadSchema.parse({
      handId: 'hand-1',
      winnerSeatIndexes: [0, 1],
      awardedAmountsBySeatIndex: { '0': 10, '1': 5 },
      totalAwarded: 15,
      isFoldWin: false,
      winningHandLabel: 'Two Pair',
    });
    expect(parsed.totalAwarded).toBe(15);
  });

  it('rejects hand result with deck field via strict schema', () => {
    expect(() =>
      HandResultPayloadSchema.parse({
        handId: 'hand-1',
        winnerSeatIndexes: [0],
        awardedAmountsBySeatIndex: { '0': 10 },
        totalAwarded: 10,
        deck: [],
      }),
    ).toThrow();
  });
});

describe('ChatMessagePayloadSchema', () => {
  it('requires message body', () => {
    expect(() =>
      ChatMessagePayloadSchema.parse({ message: 'gl hf' }),
    ).not.toThrow();
    expect(() => ChatMessagePayloadSchema.parse({ message: '' })).toThrow();
    expect(() =>
      ChatMessagePayloadSchema.parse({ message: '   ' }),
    ).toThrow();
  });
});

describe('socket-events', () => {
  it('exports stable non-empty identifiers', () => {
    expect(Object.keys(SOCKET_EVENTS).length).toBeGreaterThanOrEqual(14);
    for (const value of Object.values(SOCKET_EVENTS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(8);
      expect(value).toMatch(/^[A-Z0-9_]+$/);
    }
  });
});

describe('ClientHelloSchema', () => {
  it('matches PROTOCOL_VERSION literal', () => {
    expect(() =>
      ClientHelloSchema.parse({ protocolVersion: PROTOCOL_VERSION }),
    ).not.toThrow();
    expect(() =>
      ClientHelloSchema.parse({ protocolVersion: 999 }),
    ).toThrow();
  });
});

describe('ServerErrorPayloadSchema', () => {
  it('parses known error codes', () => {
    const payload = ServerErrorPayloadSchema.parse({
      code: 'ROOM_FULL',
      message: 'pick another neon room',
    });
    expect(payload.code).toBe('ROOM_FULL');
  });

  it('rejects unknown codes', () => {
    expect(() =>
      ServerErrorPayloadSchema.parse({ code: 'NOT_A_REAL_CODE' }),
    ).toThrow();
  });
});

describe('REST room schemas (Phase 6A)', () => {
  it('CreateRoomRequestSchema accepts allowed maxSeats', () => {
    expect(CreateRoomRequestSchema.parse({})).toEqual({});
    expect(CreateRoomRequestSchema.parse({ maxSeats: 9 })).toEqual({
      maxSeats: 9,
    });
    expect(() => CreateRoomRequestSchema.parse({ maxSeats: 5 })).toThrow();
  });

  it('RoomCodeSchema normalizes to uppercase', () => {
    expect(RoomCodeSchema.parse('abc123')).toBe('ABC123');
  });

  it('RoomIdOrCodeParamSchema accepts uuid or code', () => {
    expect(
      RoomIdOrCodeParamSchema.parse('11111111-1111-4111-8111-111111111111'),
    ).toBe('11111111-1111-4111-8111-111111111111');
    expect(RoomIdOrCodeParamSchema.parse('ROOM01')).toBe('ROOM01');
  });

  it('RoomStateSchema validates SERVER_ROOM_STATE payload', () => {
    const parsed = RoomStateSchema.parse({
      roomId: '11111111-1111-4111-8111-111111111111',
      code: 'ABC123',
      maxSeats: 9,
      status: 'waiting',
      players: [
        { playerId: 'p1', nickname: 'Neo', seatIndex: null },
      ],
    });
    expect(parsed.players).toHaveLength(1);
  });
});
