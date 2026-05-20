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
  CLIENT_REGISTER_NICKNAME,
  SERVER_ERROR,
  SERVER_ROOM_STATE,
} from '@neonpoker/shared';
import type { RoomErrorCode } from '@neonpoker/shared';
import type { Server, Socket } from 'socket.io';

import { RoomService } from './room.service';

@Injectable()
@WebSocketGateway({
  cors: { origin: true },
})
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly roomService: RoomService) {}

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

  private broadcastRoomState(roomId: string): void {
    const state = this.roomService.getRoomState(roomId);
    if (state == null) return;
    this.server.to(roomId).emit(SERVER_ROOM_STATE, state);
  }

  private emitError(
    client: Socket,
    code: RoomErrorCode,
    message?: string,
  ): void {
    client.emit(SERVER_ERROR, {
      code,
      ...(message != null ? { message } : {}),
    });
  }
}
