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
    const state = this.tableService.getTableState(roomId);
    if (state == null) {
      throw new GameOrchestrationError(
        'TABLE_NOT_FOUND',
        `No table for room ${roomId}`,
      );
    }
    return state;
  }

  startHand(roomId: string): CoreGameState {
    const room = this.requireRoom(roomId);
    if (room.players.length < 2) {
      throw new GameOrchestrationError(
        'NOT_ENOUGH_PLAYERS',
        'At least two seated players are required to start a hand',
      );
    }

    const base = this.tableService.createTableForRoom(room);

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
    state = progressGameState(state);
    this.tableService.setTableState(roomId, state);
    return state;
  }

  progressAfterAction(roomId: string): CoreGameState {
    const progressed = progressGameState(this.getGameState(roomId));
    this.tableService.setTableState(roomId, progressed);
    return progressed;
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
