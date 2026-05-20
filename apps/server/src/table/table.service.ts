import { Injectable } from '@nestjs/common';
import type { CoreGameState } from '@neonpoker/poker-core';
import { createInitialGameState } from '@neonpoker/poker-core';

import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  DEFAULT_STARTING_CHIPS,
} from '../game/game.constants';
import type { MutableInternalRoom } from '../room/room.types';

@Injectable()
export class TableService {
  private readonly tables = new Map<string, CoreGameState>();

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
    return this.tables.delete(roomId);
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
}
