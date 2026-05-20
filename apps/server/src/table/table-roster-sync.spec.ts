import { describe, expect, it } from 'vitest';
import {
  createInitialGameState,
  createSeededRandom,
  getActiveSeatIndexes,
  getContestantSeatIndexes,
  startHand,
} from '@neonpoker/poker-core';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import { RoomService } from '../room/room.service';
import type { MutableInternalRoom } from '../room/room.types';
import { foldDepartedPlayers, syncTableToRoom } from './table-roster-sync';

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

describe('syncTableToRoom', () => {
  it('preserves chip stacks for seated players between hands', () => {
    const room = roomWithPlayers(2);
    expect(room.players).toHaveLength(2);
    const base = tableFromRoom(room);
    expect(getActiveSeatIndexes(base).length).toBeGreaterThanOrEqual(2);

    const dealt = startHand(base, { rng: createSeededRandom('sync-preserve') });
    const winnerId = room.players[0]!.playerId;
    const loserId = room.players[1]!.playerId;
    const playersById = { ...dealt.playersById };
    playersById[winnerId] = Object.freeze({
      ...playersById[winnerId]!,
      chips: DEFAULT_STARTING_CHIPS + DEFAULT_BIG_BLIND + DEFAULT_SMALL_BLIND,
      hasFolded: false,
    });
    playersById[loserId] = Object.freeze({
      ...playersById[loserId]!,
      chips: DEFAULT_STARTING_CHIPS - DEFAULT_BIG_BLIND,
      hasFolded: true,
    });

    const completed = Object.freeze({
      ...dealt,
      hand: Object.freeze({
        ...dealt.hand!,
        isComplete: true,
        showdownReady: true,
      }),
      playersById: Object.freeze(playersById),
    });

    const synced = syncTableToRoom(room, completed);
    expect(synced.playersById[winnerId]!.chips).toBe(
      DEFAULT_STARTING_CHIPS + DEFAULT_BIG_BLIND + DEFAULT_SMALL_BLIND,
    );
    expect(synced.playersById[loserId]!.chips).toBe(
      DEFAULT_STARTING_CHIPS - DEFAULT_BIG_BLIND,
    );
  });
});

describe('foldDepartedPlayers', () => {
  it('removes departed seats from contestants during an active hand', () => {
    const room = roomWithPlayers(3);
    let state = startHand(tableFromRoom(room), {
      rng: createSeededRandom('fold-departed'),
    });
    expect(getContestantSeatIndexes(state).length).toBe(3);

    const departedId = room.players[2]!.playerId;
    room.players = room.players.filter((p) => p.playerId !== departedId);

    state = foldDepartedPlayers(state, room);
    state = syncTableToRoom(room, state);

    expect(
      state.table.seats.some((s) => s.playerId === departedId),
    ).toBe(false);
    expect(getContestantSeatIndexes(state).length).toBe(2);
  });
});
