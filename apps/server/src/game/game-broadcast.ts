import { Injectable } from '@nestjs/common';
import type { CoreGameState } from '@neonpoker/poker-core';
import {
  SERVER_GAME_STATE,
  SERVER_HAND_RESULT,
} from '@neonpoker/shared';
import type { Server } from 'socket.io';

import { RoomService } from '../room/room.service';
import { extractHandResult } from './hand-result';
import { toPlayerGameState } from './game-state-view';

@Injectable()
export class GameBroadcastService {
  constructor(private readonly roomService: RoomService) {}

  emitGameStateToRoom(
    server: Server,
    roomId: string,
    state: CoreGameState,
  ): void {
    const room = this.roomService.getRoom(roomId);
    if (room == null) return;

    for (let seatIndex = 0; seatIndex < room.players.length; seatIndex++) {
      const member = room.players[seatIndex]!;
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
}
