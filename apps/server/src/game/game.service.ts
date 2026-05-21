import { Injectable } from '@nestjs/common';
import type { CoreGameState, RandomSource, SeatIndex } from '@neonpoker/poker-core';
import {
  applyAction,
  createSeededRandom,
  NotEnoughPlayersError,
  startHand,
} from '@neonpoker/poker-core';
import type { PlayerActionIntent } from '@neonpoker/shared';
import { randomUUID } from 'node:crypto';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { toCorePlayerAction } from './action-mapper';
import { DEFAULT_REBUY_CHIPS } from './game.constants';
import { GameOrchestrationError } from './game.errors';
import { progressGameState } from './game-progress';
import { HandHistoryService } from './hand-history.service';
import { buildHandResultPayload } from './hand-result';
import {
  applySeatEligibility,
  clearCompletedHandForWaiting,
  countEligiblePlayers,
  foldDepartedPlayers,
  syncTableToRoom,
} from '../table/table-roster-sync';

export type GameRngFactory = (roomId: string) => RandomSource;

@Injectable()
export class GameService {
  private createRng: GameRngFactory = (roomId) =>
    createSeededRandom(`neonpoker-room-${roomId}-${randomUUID()}`);

  constructor(
    private readonly roomService: RoomService,
    private readonly tableService: TableService,
    private readonly handHistory: HandHistoryService,
  ) {}

  static forTest(options?: {
    readonly roomService?: RoomService;
    readonly tableService?: TableService;
    readonly handHistory?: HandHistoryService;
    readonly rng?: GameRngFactory;
  }): GameService {
    const tableService = options?.tableService ?? new TableService();
    const roomService = options?.roomService ?? RoomService.forTest();
    const handHistory = options?.handHistory ?? new HandHistoryService();
    const svc = new GameService(roomService, tableService, handHistory);
    if (options?.rng) {
      svc.createRng = options.rng;
    }
    return svc;
  }

  getGameState(roomId: string): CoreGameState {
    const room = this.requireRoom(roomId);
    const existing = this.tableService.getTableState(roomId);
    if (existing == null) {
      return this.tableService.ensureTableForRoom(room);
    }
    const synced = applySeatEligibility(syncTableToRoom(room, existing));
    this.tableService.setTableState(roomId, synced);
    return synced;
  }

  startHand(roomId: string): CoreGameState {
    const room = this.requireRoom(roomId);
    if (room.players.length < 2) {
      throw new GameOrchestrationError(
        'NOT_ENOUGH_PLAYERS',
        'At least two seated players are required to start a hand',
      );
    }

    const existing = this.tableService.getTableState(roomId);
    let base =
      existing != null
        ? syncTableToRoom(room, existing)
        : this.tableService.createTableForRoom(room);
    base = applySeatEligibility(base);

    if (countEligiblePlayers(base) < 2) {
      this.tableService.setTableState(roomId, base);
      throw new GameOrchestrationError(
        'NOT_ENOUGH_PLAYERS',
        'Not enough players with chips',
      );
    }

    if (base.hand != null && !base.hand.isComplete) {
      throw new GameOrchestrationError(
        'HAND_ALREADY_ACTIVE',
        'Cannot start a new hand while one is active',
      );
    }

    let started: CoreGameState;
    try {
      started = startHand(base, { rng: this.createRng(roomId) });
    } catch (err) {
      if (err instanceof NotEnoughPlayersError) {
        throw new GameOrchestrationError(
          'NOT_ENOUGH_PLAYERS',
          err.message,
        );
      }
      throw err;
    }

    this.tableService.setTableState(roomId, started);
    this.tableService.clearHandResult(roomId);
    this.handHistory.onHandStarted(room, started);
    return started;
  }

  /** MVP rebuy — restores one busted player to {@link DEFAULT_REBUY_CHIPS}; does not start a hand. */
  rebuy(roomId: string, seatIndex: SeatIndex): CoreGameState {
    const room = this.requireRoom(roomId);
    const seat = room.players[seatIndex];
    if (seat == null) {
      throw new GameOrchestrationError(
        'NOT_JOINED',
        'Player is not seated in this room',
      );
    }

    let state = this.tableService.getTableState(roomId);
    if (state == null) {
      state = this.tableService.ensureTableForRoom(room);
    }
    state = syncTableToRoom(room, state);

    const hand = state.hand;
    if (hand != null && !hand.isComplete) {
      throw new GameOrchestrationError(
        'HAND_IN_PROGRESS',
        'Cannot rebuy during an active hand',
      );
    }

    const playerId = state.table.seats[seatIndex]?.playerId;
    if (playerId == null || playerId !== seat.playerId) {
      throw new GameOrchestrationError(
        'NOT_JOINED',
        'Player is not seated at this table',
      );
    }

    const player = state.playersById[playerId];
    if (player == null) {
      throw new GameOrchestrationError(
        'NOT_JOINED',
        'Player not found at table',
      );
    }

    if (player.chips > 0) {
      throw new GameOrchestrationError(
        'NOT_BUSTED',
        'Rebuy is only available when out of chips',
      );
    }

    const handComplete = hand != null && hand.isComplete;

    const playersById: Record<string, (typeof state.playersById)[string]> =
      Object.create(null);
    for (const pid of Object.keys(state.playersById)) {
      playersById[pid] = state.playersById[pid]!;
    }
    playersById[playerId] = Object.freeze(
      handComplete
        ? {
            ...player,
            chips: DEFAULT_REBUY_CHIPS,
            isSittingOut: false,
          }
        : {
            ...player,
            chips: DEFAULT_REBUY_CHIPS,
            isSittingOut: false,
            holeCards: Object.freeze([]),
            currentBet: 0,
            totalCommitted: 0,
            hasFolded: false,
            isAllIn: false,
          },
    );

    let next = Object.freeze({
      ...state,
      playersById: Object.freeze(playersById),
    });
    next = applySeatEligibility(syncTableToRoom(room, next));
    if (handComplete) {
      this.tableService.setTableState(roomId, next);
    } else {
      next = clearCompletedHandForWaiting(next);
      this.tableService.setTableState(roomId, next);
      this.tableService.clearHandResult(roomId);
    }
    this.handHistory.onRebuy(room, seatIndex, DEFAULT_REBUY_CHIPS);
    return next;
  }

  applyPlayerAction(
    roomId: string,
    seatIndex: SeatIndex,
    action: PlayerActionIntent,
  ): CoreGameState {
    const coreAction = toCorePlayerAction(action);
    const room = this.requireRoom(roomId);
    let state = this.getGameState(roomId);

    if (state.hand == null || state.hand.isComplete) {
      throw new GameOrchestrationError(
        'NO_ACTIVE_HAND',
        'No active hand to act on',
      );
    }

    const before = state;
    state = applyAction(state, seatIndex, coreAction);
    this.handHistory.onPlayerAction(room, state, seatIndex, action);
    const progressed = progressGameState(state, room);
    state = progressed.state;
    this.handHistory.onProgress(
      room,
      before,
      state,
      progressed.showdownResult,
      progressed.isFoldWin,
    );
    if (progressed.showdownResult != null && state.hand?.handId != null) {
      this.tableService.setHandResult(
        roomId,
        buildHandResultPayload(
          state.hand.handId,
          progressed.showdownResult,
          progressed.isFoldWin,
        ),
      );
    }
    this.tableService.setTableState(roomId, state);
    return state;
  }

  progressAfterAction(roomId: string): CoreGameState {
    const room = this.requireRoom(roomId);
    const before = this.getGameState(roomId);
    const progressed = progressGameState(before, room);
    const state = progressed.state;
    this.handHistory.onProgress(
      room,
      before,
      state,
      progressed.showdownResult,
      progressed.isFoldWin,
    );
    if (progressed.showdownResult != null && state.hand?.handId != null) {
      this.tableService.setHandResult(
        roomId,
        buildHandResultPayload(
          state.hand.handId,
          progressed.showdownResult,
          progressed.isFoldWin,
        ),
      );
    }
    this.tableService.setTableState(roomId, state);
    return state;
  }

  /**
   * MVP: when fewer than two players remain, drop in-memory table state so
   * clients do not keep a stale active hand after leave/disconnect.
   */
  abortHandIfInsufficientPlayers(roomId: string): boolean {
    const room = this.roomService.getRoom(roomId);
    if (room == null || room.players.length >= 2) {
      return false;
    }
    this.tableService.deleteTable(roomId);
    this.handHistory.clearRoom(roomId);
    return true;
  }

  /**
   * After leave/disconnect with two or more players still seated: fold departed
   * seats, sync roster, auto-progress if the hand can resolve, and broadcast.
   */
  reconcileAfterRosterChange(roomId: string): CoreGameState | null {
    const room = this.requireRoom(roomId);
    if (room.players.length < 2) {
      return null;
    }

    let state = this.tableService.getTableState(roomId);
    if (state == null) {
      return null;
    }

    state = foldDepartedPlayers(state, room);
    state = syncTableToRoom(room, state);

    const before = state;
    const progressed = progressGameState(state, room);
    state = progressed.state;
    this.handHistory.onProgress(
      room,
      before,
      state,
      progressed.showdownResult,
      progressed.isFoldWin,
    );
    if (progressed.showdownResult != null && state.hand?.handId != null) {
      this.tableService.setHandResult(
        roomId,
        buildHandResultPayload(
          state.hand.handId,
          progressed.showdownResult,
          progressed.isFoldWin,
        ),
      );
    } else if (state.hand == null || !state.hand.isComplete) {
      this.tableService.clearHandResult(roomId);
    }

    this.tableService.setTableState(roomId, state);
    return state;
  }

  private requireRoom(roomId: string) {
    const room = this.roomService.getRoom(roomId);
    if (room == null) {
      throw new GameOrchestrationError(
        'ROOM_NOT_FOUND',
        `Room not found: ${roomId}`,
      );
    }
    return room;
  }
}
