import { describe, expect, it } from 'vitest';
import type { PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import { formatHandPhaseLabel, formatRoomMetaLine } from './tableRoomMeta';

const room: RoomStatePayload = {
  roomId: 'room-1',
  code: 'ABC123',
  maxSeats: 9,
  status: 'waiting',
  players: [
    { playerId: 'a', nickname: 'Alice', seatIndex: 0, connectionStatus: 'connected' },
    { playerId: 'b', nickname: 'Bob', seatIndex: 1, connectionStatus: 'connected' },
  ],
};

const baseGame: PlayerGameState = {
  tableId: 'room-1',
  maxSeats: 9,
  viewerSeatIndex: 0,
  street: null,
  boardCards: [],
  pot: { total: 0, sidePots: [] },
  dealerSeatIndex: null,
  smallBlindSeatIndex: null,
  bigBlindSeatIndex: null,
  activeSeatIndex: null,
  handId: null,
  handComplete: false,
  showdownReady: false,
  seats: [],
};

describe('tableRoomMeta', () => {
  it('pre-hand state shows WAITING', () => {
    expect(formatHandPhaseLabel(null)).toBe('WAITING');
    expect(formatHandPhaseLabel({ ...baseGame, handId: null })).toBe('WAITING');
    expect(formatRoomMetaLine(room, null)).toContain('WAITING');
    expect(formatRoomMetaLine(room, null)).toContain('waiting for hand');
  });

  it('active preflop hand shows PRE-FLOP', () => {
    const preflop = {
      ...baseGame,
      handId: 'h1',
      street: 'PRE-FLOP' as const,
    };
    expect(formatHandPhaseLabel(preflop)).toBe('PRE-FLOP');
    expect(formatRoomMetaLine(room, preflop)).toBe('ABC123 · 2/9 · PRE-FLOP');
    expect(formatRoomMetaLine(room, preflop)).not.toContain('waiting for hand');
  });

  it('completed showdown hand shows HAND COMPLETE · SHOWDOWN', () => {
    const state = {
      ...baseGame,
      handId: 'h1',
      handComplete: true,
      street: 'SHOWDOWN' as const,
      handEndKind: 'SHOWDOWN' as const,
    };
    expect(formatHandPhaseLabel(state)).toBe('HAND COMPLETE · SHOWDOWN');
    expect(formatRoomMetaLine(room, state)).toContain('HAND COMPLETE · SHOWDOWN');
  });

  it('completed fold-win shows HAND COMPLETE · FOLD WIN', () => {
    const state = {
      ...baseGame,
      handId: 'h1',
      handComplete: true,
      street: 'RIVER' as const,
      handEndKind: 'FOLD_WIN' as const,
    };
    expect(formatHandPhaseLabel(state)).toBe('HAND COMPLETE · FOLD WIN');
    expect(formatRoomMetaLine(room, state)).not.toContain('PRE-FLOP');
  });

  it('completed hand without end kind shows HAND COMPLETE', () => {
    const state = {
      ...baseGame,
      handId: 'h1',
      handComplete: true,
      street: 'SHOWDOWN' as const,
    };
    expect(formatHandPhaseLabel(state)).toBe('HAND COMPLETE');
  });

  it.each([
    ['FLOP', 'FLOP'],
    ['TURN', 'TURN'],
    ['RIVER', 'RIVER'],
    ['SHOWDOWN', 'SHOWDOWN'],
  ] as const)('street %s shows correct label', (street, label) => {
    const state = {
      ...baseGame,
      handId: 'h1',
      street,
    };
    expect(formatHandPhaseLabel(state)).toBe(label);
    expect(formatRoomMetaLine(room, state)).toContain(label);
  });
});
