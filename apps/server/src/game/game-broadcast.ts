import { Injectable } from '@nestjs/common';
import type { CoreGameState } from '@neonpoker/poker-core';
import {
  SERVER_GAME_STATE,
  SERVER_HAND_RESULT,
} from '@neonpoker/shared';
import type { Server } from 'socket.io';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { extractHandResult } from './hand-result';
import { toIdlePlayerGameState, toPlayerGameState } from './game-state-view';

@Injectable()
export class GameBroadcastService {
  constructor(
    private readonly roomService: RoomService,
    private readonly tableService: TableService,
  ) {}

  emitGameStateToRoom(
    server: Server,
    roomId: string,
    state: CoreGameState,
  ): void {
    const room = this.roomService.getRoom(roomId);
    if (room == null) return;

    for (const member of room.players) {
      const seatIndex = this.roomService.getSeatIndexForPlayer(
        roomId,
        member.playerId,
      );
      if (seatIndex == null) continue;

      const socket = server.sockets.sockets.get(member.socketId);
      if (socket == null) continue;

      const view = toPlayerGameState(state, seatIndex, room);
      socket.emit(SERVER_GAME_STATE, view);
    }
  }

  emitHandResultToRoom(
    server: Server,
    roomId: string,
    state: CoreGameState,
  ): void {
    const result = extractHandResult(state);
    if (result == null) return;
    server.to(roomId).emit(SERVER_HAND_RESULT, result);
  }

  emitGameUpdateToRoom(
    server: Server,
    roomId: string,
    state: CoreGameState,
  ): void {
    this.emitGameStateToRoom(server, roomId, state);
    if (state.hand?.isComplete) {
      this.emitHandResultToRoom(server, roomId, state);
    }
  }

  /** Broadcast no-hand snapshots so remaining clients clear active-hand UI. */
  emitWaitingGameStateToRoom(server: Server, roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (room == null || room.players.length === 0) {
      return;
    }

    const state = this.tableService.ensureTableForRoom(room);

    for (const member of room.players) {
      const seatIndex = this.roomService.getSeatIndexForPlayer(
        roomId,
        member.playerId,
      );
      if (seatIndex == null) continue;

      const socket = server.sockets.sockets.get(member.socketId);
      if (socket == null) continue;

      const view = toIdlePlayerGameState(state, seatIndex, room);
      socket.emit(SERVER_GAME_STATE, view);
    }
  }
}
