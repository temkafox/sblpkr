import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import type { MutableInternalRoom } from '../room/room.types';
import { TableService } from './table.service';

function sampleRoom(overrides?: Partial<MutableInternalRoom>): MutableInternalRoom {
  return {
    roomId: 'room-1',
    code: 'TABLE1',
    createdAt: new Date(),
    maxSeats: 6,
    status: 'waiting',
    hostPlayerId: 'p0',
    players: [
      {
        playerId: 'p0',
        nickname: 'Alpha',
        seatIndex: null,
        clientSessionId: 'ts-p0',
        socketId: 'sock-0',
        connectionStatus: 'connected',
      },
      {
        playerId: 'p1',
        nickname: 'Beta',
        seatIndex: null,
        clientSessionId: 'ts-p1',
        socketId: 'sock-1',
        connectionStatus: 'connected',
      },
    ],
    ...overrides,
  };
}

describe('TableService', () => {
  it('creates table for a room with roster seats and MVP blinds', () => {
    const svc = new TableService();
    const room = sampleRoom();

    const state = svc.createTableForRoom(room);

    expect(svc.hasTable(room.roomId)).toBe(true);
    expect(state.table.tableId).toBe(room.roomId);
    expect(state.table.maxSeats).toBe(6);
    expect(state.table.smallBlind).toBe(DEFAULT_SMALL_BLIND);
    expect(state.table.bigBlind).toBe(DEFAULT_BIG_BLIND);
    expect(Object.keys(state.playersById)).toEqual(['p0', 'p1']);
    expect(state.playersById.p0!.seatIndex).toBe(0);
    expect(state.playersById.p1!.seatIndex).toBe(1);
    expect(state.playersById.p0!.chips).toBe(DEFAULT_STARTING_CHIPS);
    expect(state.hand).toBeNull();
  });

  it('returns existing table from ensureTableForRoom', () => {
    const svc = new TableService();
    const room = sampleRoom();
    const created = svc.createTableForRoom(room);
    const ensured = svc.ensureTableForRoom(room);

    expect(ensured).toBe(created);
  });

  it('deletes table', () => {
    const svc = new TableService();
    const room = sampleRoom();
    svc.createTableForRoom(room);

    expect(svc.deleteTable(room.roomId)).toBe(true);
    expect(svc.hasTable(room.roomId)).toBe(false);
    expect(svc.getTableState(room.roomId)).toBeNull();
  });

  it('does not mutate stored state when caller mutates a retrieved reference', () => {
    const svc = new TableService();
    const room = sampleRoom();
    svc.createTableForRoom(room);

    const snapshot = svc.getTableState(room.roomId)!;
    const beforeChips = snapshot.playersById.p0!.chips;

    const mutated = Object.freeze({
      ...snapshot,
      playersById: Object.freeze({
        ...snapshot.playersById,
        p0: Object.freeze({
          ...snapshot.playersById.p0!,
          chips: 0,
        }),
      }),
    });

    svc.setTableState(room.roomId, mutated);
    const stored = svc.getTableState(room.roomId)!;

    expect(stored.playersById.p0!.chips).toBe(0);
    expect(snapshot.playersById.p0!.chips).toBe(beforeChips);
  });
});
