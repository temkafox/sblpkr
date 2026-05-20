import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  CLIENT_JOIN_ROOM,
  CLIENT_LEAVE_ROOM,
  CLIENT_PLAYER_ACTION,
  CLIENT_REGISTER_NICKNAME,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_START_HAND,
  PlayerActionPayloadSchema,
  RequestGameStatePayloadSchema,
  StartHandPayloadSchema,
  SERVER_ERROR,
  SERVER_GAME_STATE,
  SERVER_ROOM_STATE,
} from '@neonpoker/shared';
import type { SocketErrorCode } from '@neonpoker/shared';
import type { Server, Socket } from 'socket.io';

import { GameBroadcastService } from '../game/game-broadcast';
import { GameService } from '../game/game.service';
import { mapToSocketErrorCode } from '../game/poker-core-error-map';
import { toPlayerGameState } from '../game/game-state-view';
import { RoomService } from './room.service';

@Injectable()
@WebSocketGateway({
  cors: { origin: true },
})
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly gameBroadcast: GameBroadcastService,
  ) {}

  handleDisconnect(client: Socket): void {
    const roomId = this.roomService.handleDisconnect(client.id);
    if (roomId != null) {
      void client.leave(roomId);
      this.broadcastRoomState(roomId);
    }
  }

  @SubscribeMessage(CLIENT_REGISTER_NICKNAME)
  handleRegisterNickname(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const result = this.roomService.registerNickname(client.id, payload);
    if (!result.ok) {
      this.emitError(client, result.code, result.message);
    }
  }

  @SubscribeMessage(CLIENT_JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const result = this.roomService.joinRoom(client.id, payload);
    if (!result.ok) {
      this.emitError(client, result.code, result.message);
      return;
    }

    await client.join(result.roomId);
    this.broadcastRoomState(result.roomId);
  }

  @SubscribeMessage(CLIENT_LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const result = this.roomService.leaveRoom(client.id, payload);
    if (!result.ok) {
      this.emitError(client, result.code, result.message);
      return;
    }

    if (result.roomId != null) {
      void client.leave(result.roomId);
      this.broadcastRoomState(result.roomId);
    }
  }

  @SubscribeMessage(CLIENT_START_HAND)
  handleStartHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = StartHandPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid start-hand payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    if (!this.roomService.isSocketInRoom(client.id, roomId)) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before starting a hand');
      return;
    }

    try {
      const state = this.gameService.startHand(roomId);
      this.gameBroadcast.emitGameUpdateToRoom(this.server, roomId, state);
    } catch (err) {
      const mapped = mapToSocketErrorCode(err);
      this.emitError(client, mapped.code, mapped.message);
    }
  }

  @SubscribeMessage(CLIENT_PLAYER_ACTION)
  handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = PlayerActionPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid action payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    const seatIndex = this.roomService.getSeatIndexForSocket(client.id, roomId);
    if (seatIndex == null) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before acting');
      return;
    }

    try {
      const state = this.gameService.applyPlayerAction(
        roomId,
        seatIndex,
        parsed.data.action,
      );
      this.gameBroadcast.emitGameUpdateToRoom(this.server, roomId, state);
    } catch (err) {
      const mapped = mapToSocketErrorCode(err);
      this.emitError(client, mapped.code, mapped.message);
    }
  }

  @SubscribeMessage(CLIENT_REQUEST_GAME_STATE)
  handleRequestGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = RequestGameStatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid request payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    const seatIndex = this.roomService.getSeatIndexForSocket(client.id, roomId);
    if (seatIndex == null) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before requesting state');
      return;
    }

    try {
      const state = this.gameService.getGameState(roomId);
      const room = this.roomService.getRoom(roomId);
      const view = toPlayerGameState(state, seatIndex, room);
      client.emit(SERVER_GAME_STATE, view);
    } catch (err) {
      const mapped = mapToSocketErrorCode(err);
      this.emitError(client, mapped.code, mapped.message);
    }
  }

  private resolveRoomId(roomIdOrCode: string): string | null {
    const room = this.roomService.getRoom(roomIdOrCode);
    return room?.roomId ?? null;
  }

  private broadcastRoomState(roomId: string): void {
    const state = this.roomService.getRoomState(roomId);
    if (state == null) return;
    this.server.to(roomId).emit(SERVER_ROOM_STATE, state);
  }

  private emitError(
    client: Socket,
    code: SocketErrorCode,
    message?: string,
  ): void {
    client.emit(SERVER_ERROR, {
      code,
      ...(message != null ? { message } : {}),
    });
  }
}
