import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  getPlayerAtSeat,
  type Card,
} from '@neonpoker/poker-core';
import type { HandResultPayload } from '@neonpoker/shared';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { countEligiblePlayers } from '../table/table-roster-sync';
import { DEFAULT_REBUY_CHIPS, DEFAULT_STARTING_CHIPS } from './game.constants';
import { GameOrchestrationError } from './game.errors';
import { GameService } from './game.service';
import { toPlayerGameState } from './game-state-view';

function seatRoom(roomService: RoomService, count: number): string {
  const room = roomService.createRoom({ settings: { maxSeats: 6 } });
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

const card = (r: Card['r'], s: Card['s']): Card => Object.freeze({ r, s });

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
    tableService.setHandResult(roomId, {
      handId: state.hand!.handId,
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': winnerChips },
      totalAwarded: winnerChips,
      isFoldWin: true,
      winningHandLabel: null,
      potResults: [],
    });

    const after = game.rebuy(roomId, 1);
    expect(after.playersById[p1Id]!.chips).toBe(DEFAULT_REBUY_CHIPS);
    expect(after.playersById[p1Id]!.isSittingOut).toBe(false);
    expect(after.playersById[p0.playerId]!.chips).toBe(winnerChips);
    expect(after.hand?.isComplete).toBe(true);
    expect(after.hand?.handId).toBe(state.hand!.handId);
    expect(tableService.getHandResult(roomId)?.handId).toBe(state.hand!.handId);
    expect(countEligiblePlayers(after)).toBe(2);
  });

  it('rebuy after hand complete preserves board and handEndKind in wire view', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('rebuy-preserve-view'),
    });
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;
    const bustedId = room.players[1]!.playerId;

    let state = game.startHand(roomId);
    const board: readonly Card[] = Object.freeze([
      card('A', 's'),
      card('K', 'h'),
      card('Q', 'd'),
      card('J', 'c'),
      card('10', 's'),
    ]);
    state = Object.freeze({
      ...state,
      hand: Object.freeze({
        ...state.hand!,
        isComplete: true,
        showdownReady: true,
        boardCards: board,
      }),
      playersById: Object.freeze({
        ...state.playersById,
        [bustedId]: Object.freeze({
          ...state.playersById[bustedId]!,
          chips: 0,
          isSittingOut: true,
          hasFolded: true,
        }),
      }),
    });
    tableService.setTableState(roomId, state);
    const cached: HandResultPayload = {
      handId: state.hand!.handId,
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 400 },
      totalAwarded: 400,
      isFoldWin: true,
      winningHandLabel: null,
      potResults: [],
    };
    tableService.setHandResult(roomId, cached);

    const after = game.rebuy(roomId, 1);
    const view = toPlayerGameState(
      after,
      0,
      room,
      tableService.getHandResult(roomId),
    );
    expect(view.handComplete).toBe(true);
    expect(view.handId).toBe(state.hand!.handId);
    expect(view.boardCards).toEqual([...board]);
    expect(view.handEndKind).toBe('FOLD_WIN');
    expect(tableService.getHandResult(roomId)?.handId).toBe(state.hand!.handId);
  });

  it('rebuy after hand complete updates only the rebuy player stack', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({
      roomService,
      tableService,
      rng: () => createSeededRandom('rebuy-stack-only'),
    });
    const roomId = seatRoom(roomService, 2);
    const room = roomService.getRoom(roomId)!;
    const winnerId = room.players[0]!.playerId;
    const bustedId = room.players[1]!.playerId;

    let state = game.startHand(roomId);
    const winnerChips = 400;
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

    const after = game.rebuy(roomId, 1);
    expect(after.playersById[bustedId]!.chips).toBe(DEFAULT_REBUY_CHIPS);
    expect(after.playersById[winnerId]!.chips).toBe(winnerChips);
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

  it('rejects rebuy when maxRebuysPerPlayer is 0', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({ roomService, tableService });
    const created = roomService.createRoom({
      settings: { maxSeats: 6, maxRebuysPerPlayer: 0 },
    });
    const roomId = created.roomId;
    for (let i = 0; i < 2; i++) {
      const sid = `sock-d-${i}`;
      roomService.registerNickname(sid, {
        nickname: `P_${i}`,
        clientSessionId: `sess-d-${i}`,
      });
      roomService.joinRoom(sid, {
        roomId,
        clientSessionId: `sess-d-${i}`,
      });
    }
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

    expect(() => game.rebuy(roomId, 0)).toThrow(GameOrchestrationError);
  });

  it('enforces maxRebuysPerPlayer limit', () => {
    const roomService = RoomService.forTest();
    const tableService = new TableService();
    const game = GameService.forTest({ roomService, tableService });
    const created = roomService.createRoom({
      settings: {
        maxSeats: 6,
        maxRebuysPerPlayer: 1,
        rebuyAmount: 150,
      },
    });
    const roomId = created.roomId;
    for (let i = 0; i < 2; i++) {
      const sid = `sock-l-${i}`;
      roomService.registerNickname(sid, {
        nickname: `L_${i}`,
        clientSessionId: `sess-l-${i}`,
      });
      roomService.joinRoom(sid, {
        roomId,
        clientSessionId: `sess-l-${i}`,
      });
    }
    const bustedId = roomService.getRoom(roomId)!.players[1]!.playerId;

    const bust = (chips: number) => {
      tableService.setTableState(
        roomId,
        Object.freeze({
          ...tableService.createTableForRoom(roomService.getRoom(roomId)!),
          hand: null,
          playersById: Object.freeze({
            [roomService.getRoom(roomId)!.players[0]!.playerId]: Object.freeze({
              playerId: roomService.getRoom(roomId)!.players[0]!.playerId,
              seatIndex: 0,
              chips: DEFAULT_STARTING_CHIPS,
              holeCards: Object.freeze([]),
              currentBet: 0,
              totalCommitted: 0,
              hasFolded: false,
              isAllIn: false,
              isSittingOut: false,
            }),
            [bustedId]: Object.freeze({
              playerId: bustedId,
              seatIndex: 1,
              chips,
              holeCards: Object.freeze([]),
              currentBet: 0,
              totalCommitted: 0,
              hasFolded: false,
              isAllIn: false,
              isSittingOut: chips <= 0,
            }),
          }),
        }),
      );
    };

    bust(0);
    const first = game.rebuy(roomId, 1);
    expect(first.playersById[bustedId]!.chips).toBe(150);
    expect(roomService.getRoom(roomId)!.players[1]!.rebuyCount).toBe(1);

    bust(0);
    expect(() => game.rebuy(roomId, 1)).toThrow(GameOrchestrationError);
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
