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
  RegisterNicknamePayloadSchema,
} from '@neonpoker/shared';
import { randomUUID } from 'node:crypto';

import type {
  CreateRoomOptions,
  InternalSeatedPlayer,
  LeaveRoomResult,
  MutableInternalRoom,
  RegisterNicknameResult,
  RoomCodeGenerator,
  RoomIdGenerator,
  SocketSession,
} from './room.types';

const DEFAULT_MAX_SEATS = 9 as const;

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

  private generateCode: RoomCodeGenerator = defaultCodeGenerator;
  private generateId: RoomIdGenerator = defaultIdGenerator;

  static forTest(options?: {
    readonly code?: RoomCodeGenerator;
    readonly id?: RoomIdGenerator;
  }): RoomService {
    const svc = new RoomService();
    if (options?.code) svc.generateCode = options.code;
    if (options?.id) svc.generateId = options.id;
    return svc;
  }

  createRoom(options: CreateRoomOptions = {}): CreateRoomResponse {
    const maxSeats = options.maxSeats ?? DEFAULT_MAX_SEATS;

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

    const nickname = parsed.data.nickname;
    const existing = this.sessions.get(socketId);

    if (existing?.nickname === nickname && existing.playerId != null) {
      return { ok: true, playerId: existing.playerId, nickname };
    }

    const playerId = randomUUID();
    this.sessions.set(socketId, {
      socketId,
      nickname,
      playerId,
      roomId: existing?.roomId ?? null,
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

    const roomId = this.resolveRoomId(parsed.data.roomId);
    if (roomId == null) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: 'Room not found' };
    }

    if (session.roomId === roomId) {
      return {
        ok: false,
        code: 'ALREADY_JOINED',
        message: 'Socket already joined this room',
      };
    }

    const room = this.byId.get(roomId)!;

    if (this.nicknameTakenInRoom(room, session.nickname, socketId)) {
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
      this.removePlayerFromRoom(session.roomId, socketId);
    }

    const seated: InternalSeatedPlayer = {
      playerId: session.playerId,
      nickname: session.nickname,
      seatIndex: null,
      socketId,
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

    this.removePlayerFromRoom(targetRoomId, socketId);

    if (session != null) {
      this.sessions.set(socketId, { ...session, roomId: null });
    }

    return { ok: true, roomId: targetRoomId };
  }

  /** Removes socket from its current room; returns room id to broadcast, if any. */

  handleDisconnect(socketId: string): string | null {
    const session = this.sessions.get(socketId);
    if (session == null) return null;

    const roomId = session.roomId;
    if (roomId != null) {
      this.removePlayerFromRoom(roomId, socketId);
    }

    this.sessions.delete(socketId);
    return roomId;
  }

  deleteRoom(roomId: RoomId): boolean {
    const room = this.byId.get(roomId);
    if (room == null) return false;

    for (const player of room.players) {
      const session = this.sessions.get(player.socketId);
      if (session != null) {
        this.sessions.set(player.socketId, { ...session, roomId: null });
      }
    }

    this.byId.delete(roomId);
    this.idByCode.delete(room.code);
    return true;
  }

  private nicknameTakenInRoom(
    room: MutableInternalRoom,
    nickname: string,
    socketId: string,
  ): boolean {
    const key = nickname.toLowerCase();
    return room.players.some(
      (p) =>
        p.socketId !== socketId && p.nickname.toLowerCase() === key,
    );
  }

  private removePlayerFromRoom(roomId: RoomId, socketId: string): void {
    const room = this.byId.get(roomId);
    if (room == null) return;

    room.players = room.players.filter((p) => p.socketId !== socketId);

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
      players: Object.freeze(
        room.players.map((p) =>
          Object.freeze({
            playerId: p.playerId,
            nickname: p.nickname,
            seatIndex: p.seatIndex,
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
    });
  }
}
