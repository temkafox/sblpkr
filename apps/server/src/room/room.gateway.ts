import { Injectable, OnModuleInit } from '@nestjs/common';
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
  CLIENT_REBUY,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_REQUEST_HAND_HISTORY,
  CLIENT_START_HAND,
  RequestHandHistoryPayloadSchema,
  PlayerActionPayloadSchema,
  RebuyPayloadSchema,
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
import {
  toIdlePlayerGameState,
  toPlayerGameState,
} from '../game/game-state-view';
import { LOCAL_DEV_SOCKET_CORS } from '../cors.config';
import { RoomService } from './room.service';

@Injectable()
@WebSocketGateway({
  cors: LOCAL_DEV_SOCKET_CORS,
})
export class RoomGateway implements OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly gameBroadcast: GameBroadcastService,
  ) {}

  onModuleInit(): void {
    this.roomService.setGraceExpiredHandler((roomId) => {
      this.afterRoomMembershipChange(roomId);
    });
  }

  handleDisconnect(client: Socket): void {
    const result = this.roomService.handleDisconnect(client.id);
    if (result.roomId != null) {
      void client.leave(result.roomId);
      this.broadcastRoomState(result.roomId);
      this.broadcastGameStateToRoom(result.roomId);
      if (result.immediateRosterChange) {
        this.afterRoomMembershipChange(result.roomId);
      }
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
    this.broadcastGameStateToRoom(result.roomId);
    this.broadcastIdleTableStateIfNoHand(result.roomId);
    this.gameBroadcast.emitHandHistoryToClient(client, result.roomId);
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
      this.afterRoomMembershipChange(result.roomId);
    }
  }

  @SubscribeMessage(CLIENT_REBUY)
  handleRebuy(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = RebuyPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid rebuy payload',
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
      this.emitError(client, 'NOT_JOINED', 'Join the room before rebuy');
      return;
    }

    try {
      const state = this.gameService.rebuy(roomId, seatIndex);
      this.broadcastRoomState(roomId);
      this.gameBroadcast.emitIdleGameStateToRoom(this.server, roomId, state);
      this.gameBroadcast.emitHandHistoryToRoom(this.server, roomId);
    } catch (err) {
      const mapped = mapToSocketErrorCode(err);
      this.emitError(client, mapped.code, mapped.message);
    }
  }

  @SubscribeMessage(CLIENT_REQUEST_HAND_HISTORY)
  handleRequestHandHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = RequestHandHistoryPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid hand history payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    if (!this.roomService.isSocketInRoom(client.id, roomId)) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before requesting history');
      return;
    }

    this.gameBroadcast.emitHandHistoryToClient(client, roomId);
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
      const handResult = this.gameBroadcast.getHandResultForState(roomId, state);
      const view =
        state.hand == null
          ? toIdlePlayerGameState(state, seatIndex, room)
          : toPlayerGameState(state, seatIndex, room, handResult);
      client.emit(SERVER_GAME_STATE, view);
      this.gameBroadcast.emitHandResultToClient(client, roomId, state);
      this.gameBroadcast.emitHandHistoryToClient(client, roomId);
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

  /** Pushes per-viewer game snapshots so disconnected seats show AWAY during grace. */
  private broadcastGameStateToRoom(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (room == null || room.players.length === 0) {
      return;
    }

    try {
      const state = this.gameService.getGameState(roomId);
      this.gameBroadcast.emitGameStateToRoom(this.server, roomId, state);
    } catch {
      /* room removed */
    }
  }

  private afterRoomMembershipChange(roomId: string): void {
    this.broadcastRoomState(roomId);
    if (this.gameService.abortHandIfInsufficientPlayers(roomId)) {
      this.gameBroadcast.emitWaitingGameStateToRoom(this.server, roomId);
      return;
    }

    const state = this.gameService.reconcileAfterRosterChange(roomId);
    if (state != null) {
      this.gameBroadcast.emitGameUpdateToRoom(this.server, roomId, state);
      return;
    }

    this.broadcastIdleTableStateIfNoHand(roomId);
  }

  /** Keeps idle lobby stacks aligned when roster grows before the first hand. */
  private broadcastIdleTableStateIfNoHand(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (room == null || room.players.length === 0) {
      return;
    }

    try {
      const state = this.gameService.getGameState(roomId);
      if (state.hand == null) {
        this.gameBroadcast.emitIdleGameStateToRoom(this.server, roomId, state);
      }
    } catch {
      /* room removed */
    }
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
