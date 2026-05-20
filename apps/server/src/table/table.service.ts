import { Injectable } from '@nestjs/common';
import type { CoreGameState } from '@neonpoker/poker-core';
import { createInitialGameState } from '@neonpoker/poker-core';
import type { HandResultPayload } from '@neonpoker/shared';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import type { MutableInternalRoom } from '../room/room.types';
import { syncTableToRoom } from './table-roster-sync';

@Injectable()
export class TableService {
  private readonly tables = new Map<string, CoreGameState>();
  private readonly handResults = new Map<string, HandResultPayload>();

  hasTable(roomId: string): boolean {
    return this.tables.has(roomId);
  }

  getTableState(roomId: string): CoreGameState | null {
    return this.tables.get(roomId) ?? null;
  }

  setTableState(roomId: string, state: CoreGameState): void {
    this.tables.set(roomId, state);
  }

  deleteTable(roomId: string): boolean {
    this.handResults.delete(roomId);
    return this.tables.delete(roomId);
  }

  getHandResult(roomId: string): HandResultPayload | null {
    return this.handResults.get(roomId) ?? null;
  }

  setHandResult(roomId: string, result: HandResultPayload): void {
    this.handResults.set(roomId, result);
  }

  clearHandResult(roomId: string): void {
    this.handResults.delete(roomId);
  }

  /** Builds a fresh core table from the current room roster (join order → seat index). */

  createTableForRoom(room: MutableInternalRoom): CoreGameState {
    const state = createInitialGameState({
      table: {
        tableId: room.roomId,
        maxSeats: room.maxSeats,
        smallBlind: DEFAULT_SMALL_BLIND,
        bigBlind: DEFAULT_BIG_BLIND,
      },
      players: room.players.map((player, seatIndex) => ({
        playerId: player.playerId,
        seatIndex,
        startingChips: DEFAULT_STARTING_CHIPS,
      })),
    });

    this.tables.set(room.roomId, state);
    return state;
  }

  ensureTableForRoom(room: MutableInternalRoom): CoreGameState {
    const existing = this.getTableState(room.roomId);
    if (existing != null) {
      return existing;
    }
    return this.createTableForRoom(room);
  }

  /** Align seats with room roster while preserving chip stacks between hands. */
  reconcileTableWithRoom(room: MutableInternalRoom): CoreGameState | null {
    const existing = this.getTableState(room.roomId);
    if (existing == null) {
      return null;
    }
    const synced = syncTableToRoom(room, existing);
    this.tables.set(room.roomId, synced);
    return synced;
  }
}
