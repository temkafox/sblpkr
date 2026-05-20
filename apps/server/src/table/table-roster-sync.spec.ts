import { describe, expect, it } from 'vitest';
import {
  createInitialGameState,
  createSeededRandom,
  startHand,
} from '@neonpoker/poker-core';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import { RoomService } from '../room/room.service';
import type { MutableInternalRoom } from '../room/room.types';
import {
  applySeatEligibility,
  clearCompletedHandForWaiting,
  countEligiblePlayers,
  hasActiveHandInProgress,
  syncTableToRoom,
} from './table-roster-sync';

function roomWithPlayers(count: number): MutableInternalRoom {
  const roomService = RoomService.forTest();
  const created = roomService.createRoom({ maxSeats: 6 });
  for (let i = 0; i < count; i++) {
    const sid = `sock-${i}`;
    const nick = roomService.registerNickname(sid, {
      nickname: `Player_${i}`,
      clientSessionId: `session-${i}`,
    });
    if (!nick.ok) {
      throw new Error(`register failed: ${nick.message}`);
    }
    const joined = roomService.joinRoom(sid, {
      roomId: created.roomId,
      clientSessionId: `session-${i}`,
    });
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

describe('clearCompletedHandForWaiting', () => {
  it('drops completed hand while preserving chip stacks', () => {
    const room = roomWithPlayers(2);
    const base = tableFromRoom(room);
    let withHand = startHand(base, { rng: createSeededRandom('clear-hand') });
    withHand = Object.freeze({
      ...withHand,
      hand: Object.freeze({
        ...withHand.hand!,
        isComplete: true,
        showdownReady: true,
      }),
    });

    const cleared = clearCompletedHandForWaiting(withHand);
    expect(cleared.hand).toBeNull();
    expect(cleared.table.activeSeatIndex).toBeNull();
    expect(
      cleared.playersById[room.players[0]!.playerId]!.chips,
    ).toBeGreaterThan(0);
    expect(cleared.playersById[room.players[0]!.playerId]!.currentBet).toBe(0);
  });
});

describe('applySeatEligibility', () => {
  it('does not mark zero-stack all-in players sitting out during an active hand', () => {
    const room = roomWithPlayers(2);
    const base = startHand(tableFromRoom(room), {
      rng: createSeededRandom('elig-mid-hand'),
    });
    const p0 = base.playersById[room.players[0]!.playerId]!;
    const p1 = base.playersById[room.players[1]!.playerId]!;

    const midHandAllIn = Object.freeze({
      ...base,
      playersById: Object.freeze({
        [p0.playerId]: Object.freeze({
          ...p0,
          chips: 0,
          isAllIn: true,
          currentBet: 200,
          totalCommitted: 200,
        }),
        [p1.playerId]: Object.freeze({ ...p1, chips: 198 }),
      }),
    });

    expect(hasActiveHandInProgress(midHandAllIn)).toBe(true);
    const synced = applySeatEligibility(syncTableToRoom(room, midHandAllIn));
    expect(synced.playersById[p0.playerId]!.isSittingOut).toBe(false);
    expect(synced.playersById[p0.playerId]!.isAllIn).toBe(true);
  });

  it('marks zero-stack players sitting out after hand completes', () => {
    const room = roomWithPlayers(2);
    const base = startHand(tableFromRoom(room), {
      rng: createSeededRandom('elig-post-hand'),
    });
    const p0 = base.playersById[room.players[0]!.playerId]!;
    const p1 = base.playersById[room.players[1]!.playerId]!;

    const completedBusted = Object.freeze({
      ...base,
      hand: Object.freeze({
        ...base.hand!,
        isComplete: true,
        showdownReady: true,
      }),
      playersById: Object.freeze({
        [p0.playerId]: Object.freeze({ ...p0, chips: 400 }),
        [p1.playerId]: Object.freeze({ ...p1, chips: 0 }),
      }),
    });

    const synced = applySeatEligibility(syncTableToRoom(room, completedBusted));
    expect(synced.playersById[p1.playerId]!.isSittingOut).toBe(true);
    expect(synced.playersById[p0.playerId]!.isSittingOut).toBe(false);
  });

  it('marks zero-stack players sitting out when idle', () => {
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

