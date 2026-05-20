import { Injectable } from '@nestjs/common';
import type {
  CreateRoomResponse,
  GetRoomResponse,
  RoomCode,
  RoomId,
} from '@neonpoker/shared';
import { randomUUID } from 'node:crypto';

import type {
  CreateRoomOptions,
  InternalRoom,
  RoomCodeGenerator,
  RoomIdGenerator,
} from './room.types';

const DEFAULT_MAX_SEATS = 9 as const;

/** Uppercase alnum without 0/O/1/I/L for slightly clearer invite codes. */

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
  private readonly byId = new Map<RoomId, InternalRoom>();
  private readonly idByCode = new Map<RoomCode, RoomId>();

  private generateCode: RoomCodeGenerator = defaultCodeGenerator;
  private generateId: RoomIdGenerator = defaultIdGenerator;

  /** Deterministic ids/codes for unit tests (not used in production bootstrap). */
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

    const record: InternalRoom = Object.freeze({
      roomId,
      code,
      createdAt: new Date(),
      maxSeats,
      status: 'waiting',
      players: Object.freeze([]),
      hostPlayerId: null,
    });

    this.byId.set(roomId, record);
    this.idByCode.set(code, roomId);

    return this.toCreateResponse(record);
  }

  roomExists(roomIdOrCode: string): boolean {
    return this.resolveRoomId(roomIdOrCode) != null;
  }

  getRoom(roomIdOrCode: string): InternalRoom | null {
    const id = this.resolveRoomId(roomIdOrCode);
    if (id == null) return null;
    return this.byId.get(id) ?? null;
  }

  getRoomPublicState(roomIdOrCode: string): GetRoomResponse | null {
    const room = this.getRoom(roomIdOrCode);
    if (room == null) return null;
    return this.toPublicResponse(room);
  }

  /** Test helper — removes room from both indexes. */

  deleteRoom(roomId: RoomId): boolean {
    const room = this.byId.get(roomId);
    if (room == null) return false;
    this.byId.delete(roomId);
    this.idByCode.delete(room.code);
    return true;
  }

  private resolveRoomId(roomIdOrCode: string): RoomId | null {
    if (this.byId.has(roomIdOrCode)) {
      return roomIdOrCode;
    }
    const normalized = roomIdOrCode.trim().toUpperCase();
    return this.idByCode.get(normalized) ?? null;
  }

  private seatedCount(room: InternalRoom): number {
    return room.players.length;
  }

  private toCreateResponse(room: InternalRoom): CreateRoomResponse {
    return Object.freeze({
      roomId: room.roomId,
      code: room.code,
      maxSeats: room.maxSeats,
      status: room.status,
      seatedCount: this.seatedCount(room),
      createdAt: room.createdAt.toISOString(),
    });
  }

  private toPublicResponse(room: InternalRoom): GetRoomResponse {
    const seatedCount = this.seatedCount(room);
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
