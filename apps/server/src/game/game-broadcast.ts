import { Injectable } from '@nestjs/common';
import type { CoreGameState } from '@neonpoker/poker-core';
import {
  SERVER_GAME_STATE,
  SERVER_HAND_HISTORY,
  SERVER_HAND_RESULT,
  SERVER_NEXT_HAND_READY_STATE,
} from '@neonpoker/shared';
import type { HandResultPayload } from '@neonpoker/shared';
import type { Server, Socket } from 'socket.io';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import { extractHandResult } from './hand-result';
import { HandHistoryService } from './hand-history.service';
import { NextHandReadyService } from './next-hand-ready.service';
import { toIdlePlayerGameState, toPlayerGameState } from './game-state-view';

@Injectable()
export class GameBroadcastService {
  constructor(
    private readonly roomService: RoomService,
    private readonly tableService: TableService,
    private readonly handHistory: HandHistoryService,
    private readonly nextHandReady: NextHandReadyService,
  ) {}

  /** Per-viewer idle snapshots (no active hand UI) — used after rebuy. */
  emitIdleGameStateToRoom(
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
      if (member.socketId == null) continue;

      const socket = server.sockets.sockets.get(member.socketId);
      if (socket == null) continue;

      const view = toIdlePlayerGameState(state, seatIndex, room);
      socket.emit(SERVER_GAME_STATE, view);
    }
  }

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
      if (member.socketId == null) continue;

      const socket = server.sockets.sockets.get(member.socketId);
      if (socket == null) continue;

      const handResult = this.resolveHandResult(roomId, state);
      const view = toPlayerGameState(state, seatIndex, room, handResult);
      socket.emit(SERVER_GAME_STATE, view);
    }
  }

  emitHandResultToRoom(
    server: Server,
    roomId: string,
    state: CoreGameState,
  ): void {
    const result = this.resolveHandResult(roomId, state);
    if (result == null) return;
    server.to(roomId).emit(SERVER_HAND_RESULT, result);
  }

  emitHandResultToClient(
    client: Socket,
    roomId: string,
    state: CoreGameState,
  ): void {
    const result = this.resolveHandResult(roomId, state);
    if (result == null) return;
    client.emit(SERVER_HAND_RESULT, result);
  }

  getHandResultForState(
    roomId: string,
    state: CoreGameState,
  ): HandResultPayload | null {
    const cached = this.tableService.getHandResult(roomId);
    return extractHandResult(state, cached);
  }

  private resolveHandResult(
    roomId: string,
    state: CoreGameState,
  ): HandResultPayload | null {
    return this.getHandResultForState(roomId, state);
  }

  emitHandHistoryToRoom(server: Server, roomId: string): void {
    server
      .to(roomId)
      .emit(SERVER_HAND_HISTORY, this.handHistory.buildPayload(roomId));
  }

  emitHandHistoryToClient(client: Socket, roomId: string): void {
    client.emit(SERVER_HAND_HISTORY, this.handHistory.buildPayload(roomId));
  }

  emitGameUpdateToRoom(
    server: Server,
    roomId: string,
    state: CoreGameState,
  ): void {
    this.emitGameStateToRoom(server, roomId, state);
    this.emitHandHistoryToRoom(server, roomId);
    if (state.hand?.isComplete) {
      this.emitHandResultToRoom(server, roomId, state);
      const readyPayload = this.nextHandReady.onHandCompleted(roomId);
      server.to(roomId).emit(SERVER_NEXT_HAND_READY_STATE, readyPayload);
    }
  }

  emitNextHandReadyToRoom(server: Server, roomId: string): void {
    if (!this.nextHandReady.isPhaseActive(roomId)) {
      server
        .to(roomId)
        .emit(
          SERVER_NEXT_HAND_READY_STATE,
          this.nextHandReady.clearedPayload(roomId),
        );
      return;
    }
    const payload = this.nextHandReady.buildPayload(roomId);
    server.to(roomId).emit(SERVER_NEXT_HAND_READY_STATE, payload);
  }

  emitNextHandReadyToClient(client: Socket, roomId: string): void {
    if (!this.nextHandReady.isPhaseActive(roomId)) {
      client.emit(
        SERVER_NEXT_HAND_READY_STATE,
        this.nextHandReady.clearedPayload(roomId),
      );
      return;
    }
    const payload = this.nextHandReady.buildPayload(roomId);
    client.emit(SERVER_NEXT_HAND_READY_STATE, payload);
  }

  clearNextHandReadyPhase(server: Server, roomId: string): void {
    this.nextHandReady.clearPhase(roomId);
    server
      .to(roomId)
      .emit(
        SERVER_NEXT_HAND_READY_STATE,
        this.nextHandReady.clearedPayload(roomId),
      );
  }

  /** Broadcast no-hand snapshots so remaining clients clear active-hand UI. */
  emitWaitingGameStateToRoom(server: Server, roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (room == null || room.players.length === 0) {
      return;
    }

    const state =
      this.tableService.reconcileTableWithRoom(room) ??
      this.tableService.ensureTableForRoom(room);

    for (const member of room.players) {
      const seatIndex = this.roomService.getSeatIndexForPlayer(
        roomId,
        member.playerId,
      );
      if (seatIndex == null) continue;
      if (member.socketId == null) continue;

      const socket = server.sockets.sockets.get(member.socketId);
      if (socket == null) continue;

      const view = toIdlePlayerGameState(state, seatIndex, room);
      socket.emit(SERVER_GAME_STATE, view);
    }
  }
}
