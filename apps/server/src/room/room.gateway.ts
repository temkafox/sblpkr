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
  CLIENT_REQUEST_CHAT_MESSAGES,
  CLIENT_REQUEST_HAND_HISTORY,
  CLIENT_SEND_CHAT_MESSAGE,
  CLIENT_SET_NEXT_HAND_READY,
  CLIENT_START_HAND,
  RequestChatMessagesPayloadSchema,
  RequestHandHistoryPayloadSchema,
  SendChatMessagePayloadSchema,
  SERVER_CHAT_MESSAGES,
  PlayerActionPayloadSchema,
  RebuyPayloadSchema,
  RequestGameStatePayloadSchema,
  SetNextHandReadyPayloadSchema,
  StartHandPayloadSchema,
  SERVER_ERROR,
  SERVER_GAME_STATE,
  SERVER_NEXT_HAND_READY_STATE,
  SERVER_ROOM_STATE,
} from '@neonpoker/shared';
import type { SocketErrorCode } from '@neonpoker/shared';
import type { Server, Socket } from 'socket.io';

import { GameBroadcastService } from '../game/game-broadcast';
import { NextHandReadyService } from '../game/next-hand-ready.service';
import { GameService } from '../game/game.service';
import { mapToSocketErrorCode } from '../game/poker-core-error-map';
import {
  toIdlePlayerGameState,
  toPlayerGameState,
} from '../game/game-state-view';
import { ChatService, type ChatAuthor } from '../chat/chat.service';
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
    private readonly nextHandReady: NextHandReadyService,
    private readonly chatService: ChatService,
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
      this.syncNextHandReadyAfterEligibilityChange(roomId);
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

  @SubscribeMessage(CLIENT_SEND_CHAT_MESSAGE)
  handleSendChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = SendChatMessagePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid chat message payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    if (!this.roomService.isSocketInRoom(client.id, roomId)) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before sending chat');
      return;
    }

    const author = this.resolveChatAuthor(client.id, roomId);
    if (author == null) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before sending chat');
      return;
    }

    const snapshot = this.chatService.addMessage(
      roomId,
      author,
      parsed.data.text,
    );
    this.server.to(roomId).emit(SERVER_CHAT_MESSAGES, snapshot);
  }

  @SubscribeMessage(CLIENT_REQUEST_CHAT_MESSAGES)
  handleRequestChatMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = RequestChatMessagesPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid chat request payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    if (!this.roomService.isSocketInRoom(client.id, roomId)) {
      this.emitError(
        client,
        'NOT_JOINED',
        'Join the room before requesting chat',
      );
      return;
    }

    client.emit(SERVER_CHAT_MESSAGES, this.chatService.getMessages(roomId));
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

    if (this.nextHandReady.isPhaseActive(roomId)) {
      this.emitError(
        client,
        'NEXT_HAND_NOT_WAITING',
        'Use ready check for the next hand — all eligible players must ready up',
      );
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

  @SubscribeMessage(CLIENT_SET_NEXT_HAND_READY)
  handleSetNextHandReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    const parsed = SetNextHandReadyPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        'INVALID_PAYLOAD',
        parsed.error.issues[0]?.message ?? 'Invalid ready payload',
      );
      return;
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      this.emitError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    const session = this.roomService.getSession(client.id);
    if (
      session?.playerId == null ||
      !this.roomService.isSocketInRoom(client.id, roomId)
    ) {
      this.emitError(client, 'NOT_JOINED', 'Join the room before readying up');
      return;
    }

    try {
      const { payload: readyPayload, shouldStart } = this.nextHandReady.markReady(
        roomId,
        session.playerId,
      );
      this.server.to(roomId).emit(SERVER_NEXT_HAND_READY_STATE, readyPayload);
      if (shouldStart) {
        this.startNextHandFromReadyPhase(roomId);
      }
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
      this.gameBroadcast.emitNextHandReadyToClient(client, roomId);
    } catch (err) {
      const mapped = mapToSocketErrorCode(err);
      this.emitError(client, mapped.code, mapped.message);
    }
  }

  private resolveChatAuthor(socketId: string, roomId: string): ChatAuthor | null {
    const session = this.roomService.getSession(socketId);
    if (session?.playerId == null || session.roomId !== roomId) {
      return null;
    }
    const room = this.roomService.getRoom(roomId);
    const member = room?.players.find((p) => p.playerId === session.playerId);
    const nickname = member?.nickname ?? session.nickname;
    if (nickname == null || nickname.length === 0) {
      return null;
    }
    return { playerId: session.playerId, nickname };
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
      this.gameBroadcast.clearNextHandReadyPhase(this.server, roomId);
      this.gameBroadcast.emitWaitingGameStateToRoom(this.server, roomId);
      return;
    }

    const state = this.gameService.reconcileAfterRosterChange(roomId);
    if (state != null) {
      this.gameBroadcast.emitGameUpdateToRoom(this.server, roomId, state);
      this.syncNextHandReadyAfterEligibilityChange(roomId);
      return;
    }

    this.broadcastIdleTableStateIfNoHand(roomId);
    this.syncNextHandReadyAfterEligibilityChange(roomId);
  }

  private syncNextHandReadyAfterEligibilityChange(roomId: string): void {
    if (!this.nextHandReady.isPhaseActive(roomId)) {
      return;
    }
    const payload = this.nextHandReady.onEligibilityChanged(roomId);
    if (payload == null) {
      return;
    }
    this.server.to(roomId).emit(SERVER_NEXT_HAND_READY_STATE, payload);
    if (
      payload.requiredCount >= 2 &&
      payload.readyCount >= payload.requiredCount
    ) {
      this.startNextHandFromReadyPhase(roomId);
    }
  }

  private startNextHandFromReadyPhase(roomId: string): void {
    try {
      const state = this.gameService.startHand(roomId);
      this.gameBroadcast.clearNextHandReadyPhase(this.server, roomId);
      this.gameBroadcast.emitGameUpdateToRoom(this.server, roomId, state);
    } catch {
      this.gameBroadcast.emitNextHandReadyToRoom(this.server, roomId);
    }
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
