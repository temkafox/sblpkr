import { Injectable } from '@nestjs/common';
import type {
  CreateRoomResponse,
  GetRoomResponse,
  JoinRoomResult,
  RoomCode,
  RoomId,
  RoomState,
} from '@neonpoker/shared';
import {
  JoinRoomPayloadSchema,
  LeaveRoomPayloadSchema,
  mergeRoomSettings,
  RegisterNicknamePayloadSchema,
} from '@neonpoker/shared';
import type { RoomSettingsPartial } from '@neonpoker/shared';
import { randomUUID } from 'node:crypto';

import type {
  CreateRoomOptions,
  DisconnectResult,
  InternalSeatedPlayer,
  LeaveRoomResult,
  MutableInternalRoom,
  RegisterNicknameResult,
  RoomCodeGenerator,
  RoomIdGenerator,
  SocketSession,
} from './room.types';

/** Default grace when room record is missing (tests only). */
export const DISCONNECT_GRACE_MS = 30_000;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const defaultCodeGenerator: RoomCodeGenerator = () => {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx]!;
  }
  return out;
};

const defaultIdGenerator: RoomIdGenerator = () => randomUUID();

@Injectable()
export class RoomService {
  private readonly byId = new Map<RoomId, MutableInternalRoom>();
  private readonly idByCode = new Map<RoomCode, RoomId>();
  private readonly sessions = new Map<string, SocketSession>();
  private readonly playerIdByClientSession = new Map<string, string>();
  private readonly disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private generateCode: RoomCodeGenerator = defaultCodeGenerator;
  private generateId: RoomIdGenerator = defaultIdGenerator;
  private gracePeriodMs = DISCONNECT_GRACE_MS;
  private onGraceExpired: ((roomId: string) => void) | null = null;

  static forTest(options?: {
    readonly code?: RoomCodeGenerator;
    readonly id?: RoomIdGenerator;
    readonly gracePeriodMs?: number;
    readonly onGraceExpired?: (roomId: string) => void;
  }): RoomService {
    const svc = new RoomService();
    if (options?.code) svc.generateCode = options.code;
    if (options?.id) svc.generateId = options.id;
    if (options?.gracePeriodMs != null) {
      svc.gracePeriodMs = options.gracePeriodMs;
    }
    if (options?.onGraceExpired) {
      svc.onGraceExpired = options.onGraceExpired;
    }
    return svc;
  }

  setGraceExpiredHandler(handler: (roomId: string) => void): void {
    this.onGraceExpired = handler;
  }

  createRoom(options: CreateRoomOptions = {}): CreateRoomResponse {
    const settings = mergeRoomSettings(
      options.settings as RoomSettingsPartial | undefined,
    );
    const maxSeats = settings.maxSeats;

    let roomId = '';
    let code = '';
    let attempts = 0;

    do {
      if (++attempts > 32) {
        throw new Error('Failed to allocate unique room code');
      }
      roomId = this.generateId();
      code = this.generateCode();
    } while (this.idByCode.has(code) || this.byId.has(roomId));

    const record: MutableInternalRoom = {
      roomId,
      code,
      createdAt: new Date(),
      maxSeats,
      status: 'waiting',
      players: [],
      hostPlayerId: null,
      settings,
      actionDeadlineAt: null,
    };

    this.byId.set(roomId, record);
    this.idByCode.set(code, roomId);

    return this.toCreateResponse(record);
  }

  roomExists(roomIdOrCode: string): boolean {
    return this.resolveRoomId(roomIdOrCode) != null;
  }

  getRoom(roomIdOrCode: string): MutableInternalRoom | null {
    const id = this.resolveRoomId(roomIdOrCode);
    if (id == null) return null;
    return this.byId.get(id) ?? null;
  }

  getRoomPublicState(roomIdOrCode: string): GetRoomResponse | null {
    const room = this.getRoom(roomIdOrCode);
    if (room == null) return null;
    return this.toPublicResponse(room);
  }

  getRoomState(roomIdOrCode: string): RoomState | null {
    const room = this.getRoom(roomIdOrCode);
    if (room == null) return null;
    return this.toRoomState(room);
  }

  getSession(socketId: string): SocketSession | null {
    return this.sessions.get(socketId) ?? null;
  }

  /** Join-order seat index for a seated player (Phase 6C2). */

  getSeatIndexForPlayer(roomId: string, playerId: string): number | null {
    const room = this.byId.get(roomId);
    if (room == null) return null;
    const idx = room.players.findIndex((p) => p.playerId === playerId);
    return idx >= 0 ? idx : null;
  }

  getSeatIndexForSocket(socketId: string, roomId: string): number | null {
    const session = this.sessions.get(socketId);
    if (session?.playerId == null || session.roomId !== roomId) {
      return null;
    }
    return this.getSeatIndexForPlayer(roomId, session.playerId);
  }

  isSocketInRoom(socketId: string, roomId: string): boolean {
    return this.getSeatIndexForSocket(socketId, roomId) != null;
  }

  registerNickname(
    socketId: string,
    payload: unknown,
  ): RegisterNicknameResult {
    const parsed = RegisterNicknamePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? 'Invalid nickname payload';
      return { ok: false, code: 'INVALID_PAYLOAD', message };
    }

    const { nickname, clientSessionId } = parsed.data;
    const existing = this.sessions.get(socketId);

    let playerId = this.playerIdByClientSession.get(clientSessionId);
    if (playerId == null) {
      playerId = randomUUID();
      this.playerIdByClientSession.set(clientSessionId, playerId);
    }

    const priorRoomId = this.findRoomIdForClientSession(clientSessionId);

    this.sessions.set(socketId, {
      socketId,
      clientSessionId,
      nickname,
      playerId,
      roomId: existing?.roomId ?? priorRoomId,
    });

    return { ok: true, playerId, nickname };
  }

  joinRoom(socketId: string, payload: unknown): JoinRoomResult {
    const session = this.sessions.get(socketId);
    if (session?.nickname == null || session.playerId == null) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Register nickname before joining a room',
      };
    }

    const parsed = JoinRoomPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: parsed.error.issues[0]?.message ?? 'Invalid join payload',
      };
    }

    const clientSessionId = parsed.data.clientSessionId;
    if (clientSessionId !== session.clientSessionId) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Client session id does not match registration',
      };
    }

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: 'Room not found' };
    }

    const room = this.byId.get(roomId)!;
    const existing = room.players.find(
      (p) => p.clientSessionId === clientSessionId,
    );

    if (existing != null) {
      if (session.roomId === roomId && existing.socketId === socketId) {
        return {
          ok: false,
          code: 'ALREADY_JOINED',
          message: 'Socket already joined this room',
        };
      }

      this.cancelDisconnectGrace(roomId, clientSessionId);
      existing.socketId = socketId;
      existing.connectionStatus = 'connected';
      existing.disconnectedAt = undefined;
      existing.nickname = session.nickname;

      if (session.roomId != null && session.roomId !== roomId) {
        this.removePlayerFromRoom(session.roomId, clientSessionId);
      }

      this.sessions.set(socketId, { ...session, roomId });
      return { ok: true, roomId };
    }

    if (session.roomId === roomId) {
      return {
        ok: false,
        code: 'ALREADY_JOINED',
        message: 'Socket already joined this room',
      };
    }

    if (this.nicknameTakenInRoom(room, session.nickname, clientSessionId)) {
      return {
        ok: false,
        code: 'NICKNAME_TAKEN',
        message: 'Nickname already in use in this room',
      };
    }

    if (room.players.length >= room.maxSeats) {
      return { ok: false, code: 'ROOM_FULL', message: 'Room is full' };
    }

    if (session.roomId != null) {
      this.removePlayerFromRoom(session.roomId, clientSessionId);
    }

    const seated: InternalSeatedPlayer = {
      playerId: session.playerId,
      nickname: session.nickname,
      seatIndex: room.players.length,
      clientSessionId,
      socketId,
      connectionStatus: 'connected',
      rebuyCount: 0,
    };

    room.players.push(seated);
    if (room.hostPlayerId == null) {
      room.hostPlayerId = session.playerId;
    }

    this.sessions.set(socketId, { ...session, roomId });

    return { ok: true, roomId };
  }

  leaveRoom(socketId: string, payload: unknown = {}): LeaveRoomResult {
    const parsed = LeaveRoomPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: parsed.error.issues[0]?.message ?? 'Invalid leave payload',
      };
    }

    const session = this.sessions.get(socketId);
    const targetRoomId =
      parsed.data.roomId != null
        ? this.resolveRoomId(parsed.data.roomId)
        : (session?.roomId ?? null);

    if (targetRoomId == null) {
      return { ok: true, roomId: null };
    }

    if (!this.byId.has(targetRoomId)) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: 'Room not found' };
    }

    if (session?.clientSessionId != null) {
      this.removePlayerFromRoom(targetRoomId, session.clientSessionId);
    }

    if (session != null) {
      this.sessions.set(socketId, { ...session, roomId: null });
    }

    return { ok: true, roomId: targetRoomId };
  }

  /** Marks disconnect; roster removal is deferred until grace expires. */

  handleDisconnect(socketId: string): DisconnectResult {
    const session = this.sessions.get(socketId);
    if (session == null) {
      return { roomId: null, immediateRosterChange: false };
    }

    const roomId = session.roomId;
    this.sessions.delete(socketId);

    if (roomId == null) {
      return { roomId: null, immediateRosterChange: false };
    }

    const room = this.byId.get(roomId);
    const player = room?.players.find(
      (p) => p.clientSessionId === session.clientSessionId,
    );

    if (player == null) {
      return { roomId, immediateRosterChange: true };
    }

    player.socketId = null;
    player.connectionStatus = 'disconnected';
    player.disconnectedAt = Date.now();
    this.scheduleDisconnectGrace(roomId, session.clientSessionId);

    return { roomId, immediateRosterChange: false };
  }

  deleteRoom(roomId: RoomId): boolean {
    const room = this.byId.get(roomId);
    if (room == null) return false;

    for (const player of room.players) {
      this.cancelDisconnectGrace(roomId, player.clientSessionId);
      if (player.socketId != null) {
        const session = this.sessions.get(player.socketId);
        if (session != null) {
          this.sessions.set(player.socketId, { ...session, roomId: null });
        }
      }
    }

    this.byId.delete(roomId);
    this.idByCode.delete(room.code);
    return true;
  }

  private findRoomIdForClientSession(
    clientSessionId: string,
  ): string | null {
    for (const room of this.byId.values()) {
      if (room.players.some((p) => p.clientSessionId === clientSessionId)) {
        return room.roomId;
      }
    }
    return null;
  }

  private graceKey(roomId: string, clientSessionId: string): string {
    return `${roomId}:${clientSessionId}`;
  }

  setActionDeadline(roomId: string, deadlineAt: number | null): void {
    const room = this.byId.get(roomId);
    if (room == null) {
      return;
    }
    room.actionDeadlineAt = deadlineAt;
  }

  getRebuyCount(roomId: string, playerId: string): number {
    const room = this.byId.get(roomId);
    const member = room?.players.find((p) => p.playerId === playerId);
    return member?.rebuyCount ?? 0;
  }

  incrementRebuyCount(roomId: string, playerId: string): void {
    const room = this.byId.get(roomId);
    const member = room?.players.find((p) => p.playerId === playerId);
    if (member != null) {
      member.rebuyCount += 1;
    }
  }

  private scheduleDisconnectGrace(
    roomId: string,
    clientSessionId: string,
  ): void {
    const key = this.graceKey(roomId, clientSessionId);
    const prior = this.disconnectTimers.get(key);
    if (prior != null) {
      clearTimeout(prior);
    }

    const room = this.byId.get(roomId);
    const graceMs =
      room != null
        ? room.settings.disconnectGraceSeconds * 1000
        : this.gracePeriodMs;

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(key);
      this.finalizeDisconnect(roomId, clientSessionId);
    }, graceMs);

    this.disconnectTimers.set(key, timer);
  }

  private cancelDisconnectGrace(
    roomId: string,
    clientSessionId: string,
  ): void {
    const key = this.graceKey(roomId, clientSessionId);
    const timer = this.disconnectTimers.get(key);
    if (timer != null) {
      clearTimeout(timer);
      this.disconnectTimers.delete(key);
    }
  }

  private finalizeDisconnect(roomId: string, clientSessionId: string): void {
    const room = this.byId.get(roomId);
    if (room == null) return;

    const player = room.players.find(
      (p) =>
        p.clientSessionId === clientSessionId &&
        p.socketId == null &&
        p.disconnectedAt != null,
    );
    if (player == null) {
      return;
    }

    this.removePlayerFromRoom(roomId, clientSessionId);
    this.onGraceExpired?.(roomId);
  }

  private nicknameTakenInRoom(
    room: MutableInternalRoom,
    nickname: string,
    clientSessionId: string,
  ): boolean {
    const key = nickname.toLowerCase();
    return room.players.some(
      (p) =>
        p.clientSessionId !== clientSessionId &&
        p.nickname.toLowerCase() === key,
    );
  }

  private removePlayerFromRoom(
    roomId: RoomId,
    clientSessionId: string,
  ): void {
    const room = this.byId.get(roomId);
    if (room == null) return;

    this.cancelDisconnectGrace(roomId, clientSessionId);

    room.players = room.players.filter(
      (p) => p.clientSessionId !== clientSessionId,
    );

    for (let i = 0; i < room.players.length; i++) {
      room.players[i]!.seatIndex = i;
    }

    if (
      room.hostPlayerId != null &&
      !room.players.some((p) => p.playerId === room.hostPlayerId)
    ) {
      room.hostPlayerId = room.players[0]?.playerId ?? null;
    }
  }

  private resolveRoomId(roomIdOrCode: string): RoomId | null {
    const trimmed = roomIdOrCode.trim();
    if (this.byId.has(trimmed)) {
      return trimmed;
    }
    const normalized = trimmed.toUpperCase();
    return this.idByCode.get(normalized) ?? null;
  }

  private toRoomState(room: MutableInternalRoom): RoomState {
    return Object.freeze({
      roomId: room.roomId,
      code: room.code,
      maxSeats: room.maxSeats,
      status: room.status,
      settings: room.settings,
      players: Object.freeze(
        room.players.map((p) =>
          Object.freeze({
            playerId: p.playerId,
            nickname: p.nickname,
            seatIndex: p.seatIndex,
            connectionStatus: p.connectionStatus,
          }),
        ),
      ),
    });
  }

  private toCreateResponse(room: MutableInternalRoom): CreateRoomResponse {
    return Object.freeze({
      roomId: room.roomId,
      code: room.code,
      maxSeats: room.maxSeats,
      status: room.status,
      seatedCount: room.players.length,
      createdAt: room.createdAt.toISOString(),
      settings: room.settings,
    });
  }

  private toPublicResponse(room: MutableInternalRoom): GetRoomResponse {
    const seatedCount = room.players.length;
    return Object.freeze({
      roomId: room.roomId,
      code: room.code,
      maxSeats: room.maxSeats,
      status: room.status,
      seatedCount,
      capacityAvailable: seatedCount < room.maxSeats,
      settings: room.settings,
    });
  }
}
