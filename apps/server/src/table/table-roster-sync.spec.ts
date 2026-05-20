import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '@neonpoker/poker-core';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import { RoomService } from '../room/room.service';
import type { MutableInternalRoom } from '../room/room.types';
import {
  applySeatEligibility,
  countEligiblePlayers,
  syncTableToRoom,
} from './table-roster-sync';

function roomWithPlayers(count: number): MutableInternalRoom {
  const roomService = RoomService.forTest();
  const created = roomService.createRoom({ maxSeats: 6 });
  for (let i = 0; i < count; i++) {
    const sid = `sock-${i}`;
    const nick = roomService.registerNickname(sid, {
      nickname: `Player_${i}`,
    });
    if (!nick.ok) {
      throw new Error(`register failed: ${nick.message}`);
    }
    const joined = roomService.joinRoom(sid, { roomId: created.roomId });
    if (!joined.ok) {
      throw new Error(`join failed: ${joined.message}`);
    }
  }
  return roomService.getRoom(created.roomId)!;
}

function tableFromRoom(room: MutableInternalRoom) {
  return createInitialGameState({
    table: {
      tableId: room.roomId,
      maxSeats: room.maxSeats,
      smallBlind: DEFAULT_SMALL_BLIND,
      bigBlind: DEFAULT_BIG_BLIND,
    },
    players: room.players.map((p, seatIndex) => ({
      playerId: p.playerId,
      seatIndex,
      startingChips: DEFAULT_STARTING_CHIPS,
    })),
  });
}

describe('applySeatEligibility', () => {
  it('marks zero-stack players sitting out', () => {
    const room = roomWithPlayers(2);
    const base = tableFromRoom(room);
    const p0 = base.playersById[room.players[0]!.playerId]!;
    const p1 = base.playersById[room.players[1]!.playerId]!;
    const busted = Object.freeze({
      ...base,
      playersById: Object.freeze({
        [p0.playerId]: Object.freeze({ ...p0, chips: 400 }),
        [p1.playerId]: Object.freeze({ ...p1, chips: 0 }),
      }),
    });

    const synced = applySeatEligibility(syncTableToRoom(room, busted));
    expect(synced.playersById[p1.playerId]!.isSittingOut).toBe(true);
    expect(synced.playersById[p0.playerId]!.isSittingOut).toBe(false);
    expect(countEligiblePlayers(synced)).toBe(1);
  });
});

