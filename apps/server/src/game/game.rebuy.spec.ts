import { describe, expect, it } from 'vitest';
import { createSeededRandom, getPlayerAtSeat } from '@neonpoker/poker-core';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { countEligiblePlayers } from '../table/table-roster-sync';
import { DEFAULT_REBUY_CHIPS, DEFAULT_STARTING_CHIPS } from './game.constants';
import { GameOrchestrationError } from './game.errors';
import { GameService } from './game.service';

function seatRoom(roomService: RoomService, count: number): string {
  const room = roomService.createRoom({ maxSeats: 6 });
  for (let i = 0; i < count; i++) {
    const sid = `sock-${i}`;
    roomService.registerNickname(sid, {
      nickname: `Player_${i}`,
      clientSessionId: `session-${i}`,
    });
    roomService.joinRoom(sid, {
      roomId: room.roomId,
      clientSessionId: `session-${i}`,
    });
  }
  return room.roomId;
}

describe('GameService.rebuy (Phase 7G)', () => {
  it('restores busted player to DEFAULT_REBUY_CHIPS without changing others', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('rebuy-ok'),
    });
    const roomId = seatRoom(roomService, 2);

    let state = game.startHand(roomId);
    const p0 = state.playersById[roomService.getRoom(roomId)!.players[0]!.playerId]!;
    const p1Id = roomService.getRoom(roomId)!.players[1]!.playerId;
    const winnerChips = p0.chips + state.playersById[p1Id]!.chips;

    state = Object.freeze({
      ...state,
      hand: Object.freeze({ ...state.hand!, isComplete: true, showdownReady: true }),
      playersById: Object.freeze({
        ...state.playersById,
        [p0.playerId]: Object.freeze({ ...p0, chips: winnerChips }),
        [p1Id]: Object.freeze({
          ...state.playersById[p1Id]!,
          chips: 0,
          isSittingOut: true,
        }),
      }),
    });
    tableService.setTableState(roomId, state);

    const after = game.rebuy(roomId, 1);
    expect(after.playersById[p1Id]!.chips).toBe(DEFAULT_REBUY_CHIPS);
    expect(after.playersById[p1Id]!.isSittingOut).toBe(false);
    expect(after.playersById[p0.playerId]!.chips).toBe(winnerChips);
    expect(after.hand).toBeNull();
    expect(countEligiblePlayers(after)).toBe(2);
  });

  it('rejects rebuy when player still has chips', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({ roomService, tableService });
    const roomId = seatRoom(roomService, 2);

    let state = game.startHand(roomId);
    state = Object.freeze({
      ...state,
      hand: Object.freeze({ ...state.hand!, isComplete: true, showdownReady: true }),
    });
    tableService.setTableState(roomId, state);

    try {
      game.rebuy(roomId, 0);
      expect.fail('expected throw');
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('NOT_BUSTED');
    }
  });

  it('rejects rebuy when player is not seated in room', () => {
    const roomService = RoomService.forTest();
    const game = GameService.forTest({ roomService, tableService: new TableService() });
    const roomId = seatRoom(roomService, 2);

    try {
      game.rebuy(roomId, 5);
      expect.fail('expected throw');
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('NOT_JOINED');
    }
  });

  it('rejects rebuy during active in-progress hand', () => {
    const roomService = RoomService.forTest();
    const game = GameService.forTest({
      roomService,
      tableService: new TableService(),
      rng: () => createSeededRandom('rebuy-active'),
    });
    const roomId = seatRoom(roomService, 2);
    game.startHand(roomId);

    try {
      game.rebuy(roomId, 0);
      expect.fail('expected throw');
    } catch (err) {
      expect((err as GameOrchestrationError).code).toBe('HAND_IN_PROGRESS');
    }
  });

  it('allows rebuy after hand complete and makes player eligible for next hand', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('rebuy-next'),
    });
    const roomId = seatRoom(roomService, 2);

    let state = game.startHand(roomId);
    const bustedId = roomService.getRoom(roomId)!.players[1]!.playerId;
    const winnerId = roomService.getRoom(roomId)!.players[0]!.playerId;
    const winnerChips =
      state.playersById[winnerId]!.chips + state.playersById[bustedId]!.chips;

    state = Object.freeze({
      ...state,
      hand: Object.freeze({ ...state.hand!, isComplete: true, showdownReady: true }),
      playersById: Object.freeze({
        [winnerId]: Object.freeze({
          ...state.playersById[winnerId]!,
          chips: winnerChips,
        }),
        [bustedId]: Object.freeze({
          ...state.playersById[bustedId]!,
          chips: 0,
          isSittingOut: true,
        }),
      }),
    });
    tableService.setTableState(roomId, state);

    game.rebuy(roomId, 1);
    const next = game.startHand(roomId);
    expect(getPlayerAtSeat(next, 1)!.holeCards.length).toBe(2);
    expect(getPlayerAtSeat(next, 0)!.holeCards.length).toBe(2);
  });

  it('does not auto-start a hand after rebuy', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({ roomService, tableService });
    const roomId = seatRoom(roomService, 2);
    const bustedId = roomService.getRoom(roomId)!.players[0]!.playerId;

    tableService.setTableState(
      roomId,
      Object.freeze({
        ...tableService.createTableForRoom(roomService.getRoom(roomId)!),
        playersById: Object.freeze({
          [bustedId]: Object.freeze({
            playerId: bustedId,
            seatIndex: 0,
            chips: 0,
            holeCards: Object.freeze([]),
            currentBet: 0,
            totalCommitted: 0,
            hasFolded: false,
            isAllIn: false,
            isSittingOut: true,
          }),
          [roomService.getRoom(roomId)!.players[1]!.playerId]: Object.freeze({
            playerId: roomService.getRoom(roomId)!.players[1]!.playerId,
            seatIndex: 1,
            chips: DEFAULT_STARTING_CHIPS,
            holeCards: Object.freeze([]),
            currentBet: 0,
            totalCommitted: 0,
            hasFolded: false,
            isAllIn: false,
            isSittingOut: false,
          }),
        }),
      }),
    );

    const after = game.rebuy(roomId, 0);
    expect(after.hand).toBeNull();
  });
});
