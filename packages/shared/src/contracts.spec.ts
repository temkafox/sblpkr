import { describe, expect, it } from 'vitest';

import {
  ChatMessagesPayloadSchema,
  RequestChatMessagesPayloadSchema,
  SendChatMessagePayloadSchema,
  ClientHelloSchema,
  CreateRoomRequestSchema,
  HandHistoryPayloadSchema,
  HandResultPayloadSchema,
  JoinRoomPayloadSchema,
  PublicSeatActionSchema,
  RoomStateSchema,
  PlayerActionPayloadSchema,
  PROTOCOL_VERSION,
  RegisterNicknamePayloadSchema,
  RebuyPayloadSchema,
  RoomCodeSchema,
  RoomIdOrCodeParamSchema,
  ServerErrorPayloadSchema,
  SOCKET_EVENTS,
} from './index';

describe('RegisterNicknamePayloadSchema', () => {
  it('accepts valid nicknames', () => {
    const parsed = RegisterNicknamePayloadSchema.parse({
      nickname: 'Neo_Player',
      clientSessionId: 'browser-session-1',
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(parsed.nickname).toBe('Neo_Player');
  });

  it('trims nickname', () => {
    const parsed = RegisterNicknamePayloadSchema.parse({
      nickname: '  valid_name  ',
      clientSessionId: 'browser-session-2',
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
      JoinRoomPayloadSchema.parse({
        roomId: 'ROOM1234',
        clientSessionId: 'browser-session-3',
      }),
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

describe('HandHistoryPayloadSchema', () => {
  it('parses grouped street history without private fields', () => {
    const parsed = HandHistoryPayloadSchema.parse({
      roomId: 'room-1',
      handId: 'hand-1',
      handNumber: 1,
      revision: 0,
      streets: [
        {
          street: 'PRE-FLOP',
          entries: [
            {
              seq: 0,
              street: 'PRE-FLOP',
              text: 'Alpha posts small blind $1',
              nickname: 'Alpha',
              actionKind: 'post_sb',
              amount: 1,
            },
          ],
        },
      ],
    });
    expect(parsed.streets[0]?.entries[0]?.amount).toBe(1);
    expect(() =>
      HandHistoryPayloadSchema.parse({
        roomId: 'room-1',
        handId: 'hand-1',
        handNumber: 1,
        revision: 0,
        streets: [],
        deck: [],
      }),
    ).toThrow();
  });
});

describe('PublicSeatActionSchema', () => {
  it('parses check and raise actions', () => {
    expect(PublicSeatActionSchema.parse({ kind: 'check' }).kind).toBe('check');
    expect(
      PublicSeatActionSchema.parse({ kind: 'raise', amount: 40 }).amount,
    ).toBe(40);
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

describe('SendChatMessagePayloadSchema', () => {
  it('accepts trimmed text up to 200 chars', () => {
    const parsed = SendChatMessagePayloadSchema.parse({
      roomId: '11111111-1111-4111-8111-111111111111',
      text: '  gl hf  ',
    });
    expect(parsed.text).toBe('gl hf');
  });

  it('rejects empty or whitespace-only text', () => {
    expect(() =>
      SendChatMessagePayloadSchema.parse({
        roomId: '11111111-1111-4111-8111-111111111111',
        text: '',
      }),
    ).toThrow();
    expect(() =>
      SendChatMessagePayloadSchema.parse({
        roomId: '11111111-1111-4111-8111-111111111111',
        text: '   ',
      }),
    ).toThrow();
  });

  it('rejects text longer than 200 chars', () => {
    expect(() =>
      SendChatMessagePayloadSchema.parse({
        roomId: '11111111-1111-4111-8111-111111111111',
        text: 'x'.repeat(201),
      }),
    ).toThrow();
  });
});

describe('RequestChatMessagesPayloadSchema', () => {
  it('requires roomId', () => {
    const parsed = RequestChatMessagesPayloadSchema.parse({
      roomId: 'ABC123',
    });
    expect(parsed.roomId).toBe('ABC123');
  });
});

describe('ChatMessagesPayloadSchema', () => {
  it('parses chat snapshot', () => {
    const parsed = ChatMessagesPayloadSchema.parse({
      roomId: 'room-1',
      messages: [
        {
          id: 'm1',
          roomId: 'room-1',
          playerId: 'p1',
          nickname: 'Neo',
          text: 'hi',
          sequence: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(parsed.messages).toHaveLength(1);
  });
});

describe('RebuyPayloadSchema', () => {
  it('parses roomId', () => {
    const parsed = RebuyPayloadSchema.parse({ roomId: 'room-abc' });
    expect(parsed.roomId).toBe('room-abc');
  });

  it('rejects empty roomId', () => {
    expect(() => RebuyPayloadSchema.parse({ roomId: '' })).toThrow();
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
        { playerId: 'p1', nickname: 'Neo', seatIndex: null, connectionStatus: 'connected' },
      ],
    });
    expect(parsed.players).toHaveLength(1);
  });
});
