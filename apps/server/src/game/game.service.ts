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
import { GameOrchestrationError } from './game.errors';
import { progressGameState } from './game-progress';
import { buildHandResultPayload } from './hand-result';
import {
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
  ) {}

  static forTest(options?: {
    readonly roomService?: RoomService;
    readonly tableService?: TableService;
    readonly rng?: GameRngFactory;
  }): GameService {
    const tableService = options?.tableService ?? new TableService();
    const roomService = options?.roomService ?? RoomService.forTest();
    const svc = new GameService(roomService, tableService);
    if (options?.rng) {
      svc.createRng = options.rng;
    }
    return svc;
  }

  getGameState(roomId: string): CoreGameState {
    const room = this.requireRoom(roomId);
    const existing = this.tableService.getTableState(roomId);
    if (existing != null) {
      return existing;
    }
    return this.tableService.ensureTableForRoom(room);
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
    const base =
      existing != null
        ? syncTableToRoom(room, existing)
        : this.tableService.createTableForRoom(room);

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
    return started;
  }

  applyPlayerAction(
    roomId: string,
    seatIndex: SeatIndex,
    action: PlayerActionIntent,
  ): CoreGameState {
    const coreAction = toCorePlayerAction(action);
    let state = this.getGameState(roomId);

    if (state.hand == null || state.hand.isComplete) {
      throw new GameOrchestrationError(
        'NO_ACTIVE_HAND',
        'No active hand to act on',
      );
    }

    state = applyAction(state, seatIndex, coreAction);
    const progressed = progressGameState(state);
    state = progressed.state;
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
    const progressed = progressGameState(this.getGameState(roomId));
    const state = progressed.state;
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

    const progressed = progressGameState(state);
    state = progressed.state;
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
