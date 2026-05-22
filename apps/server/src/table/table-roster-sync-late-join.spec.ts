import { describe, expect, it } from 'vitest';
import {
  createInitialGameState,
  createSeededRandom,
  getHandParticipantSeatIndexes,
  NotInHandError,
  startHand,
} from '@neonpoker/poker-core';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import { GameService } from '../game/game.service';
import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { syncTableToRoom } from './table-roster-sync';

function joinPlayer(
  roomService: RoomService,
  roomId: string,
  nickname: string,
  sessionId: string,
): void {
  const sid = `sock-${sessionId}`;
  const reg = roomService.registerNickname(sid, {
    nickname,
    clientSessionId: sessionId,
  });
  if (!reg.ok) throw new Error(reg.message);
  const joined = roomService.joinRoom(sid, {
    roomId,
    clientSessionId: sessionId,
  });
  if (!joined.ok) throw new Error(joined.message);
}

describe('syncTableToRoom late joiner', () => {
  it('adds mid-hand joiner as sitting out without extending participants', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const created = roomService.createRoom({ settings: { maxSeats: 6 } });
    joinPlayer(roomService, created.roomId, 'ASD', 'a');
    joinPlayer(roomService, created.roomId, '3fff', 'b');

    const room = roomService.getRoom(created.roomId)!;
    let state = startHand(
      createInitialGameState({
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
      }),
      { rng: createSeededRandom('sync-late') },
    );
    tableService.setTableState(room.roomId, state);
    const participantsBefore = [...getHandParticipantSeatIndexes(state)];

    joinPlayer(roomService, created.roomId, '1234', 'c');
    const roomAfter = roomService.getRoom(created.roomId)!;
    state = syncTableToRoom(roomAfter, tableService.getTableState(room.roomId)!);

    expect(participantsBefore).toEqual([...getHandParticipantSeatIndexes(state)]);
    expect(getHandParticipantSeatIndexes(state)).toHaveLength(2);

    const late = state.playersById[
      roomAfter.players.find((p) => p.nickname === '1234')!.playerId
    ]!;
    expect(late.holeCards).toHaveLength(0);
    expect(late.isSittingOut).toBe(true);
    expect(state.table.activeSeatIndex).not.toBe(late.seatIndex);
  });
});

describe('GameService late joiner', () => {
  it('rejects action from player who joined during active hand', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({ roomService, tableService });

    const created = roomService.createRoom({ settings: { maxSeats: 6 } });
    joinPlayer(roomService, created.roomId, 'ASD', 'a');
    joinPlayer(roomService, created.roomId, '3fff', 'b');
    game.startHand(created.roomId);

    joinPlayer(roomService, created.roomId, '1234', 'c');
    const room = roomService.getRoom(created.roomId)!;
    const late = room.players.find((p) => p.nickname === '1234')!;
    const lateSeat = late.seatIndex!;

    expect(() =>
      game.applyPlayerAction(created.roomId, lateSeat, { kind: 'call' }),
    ).toThrow(NotInHandError);

    const state = game.getGameState(created.roomId);
    expect(state.table.activeSeatIndex).not.toBe(lateSeat);
  });
});
