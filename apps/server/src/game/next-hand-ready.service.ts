import { Injectable } from '@nestjs/common';
import type { NextHandReadyStatePayload } from '@neonpoker/shared';

import { RoomService } from '../room/room.service';
import { TableService } from '../table/table.service';
import {
  applySeatEligibility,
  listEligiblePlayersForNextHand,
  syncTableToRoom,
} from '../table/table-roster-sync';
import { GameOrchestrationError } from './game.errors';

@Injectable()
export class NextHandReadyService {
  private readonly readyByRoom = new Map<string, Set<string>>();
  private readonly phaseActive = new Set<string>();

  constructor(
    private readonly roomService: RoomService,
    private readonly tableService: TableService,
  ) {}

  isPhaseActive(roomId: string): boolean {
    return this.phaseActive.has(roomId);
  }

  clearPhase(roomId: string): void {
    this.phaseActive.delete(roomId);
    this.readyByRoom.delete(roomId);
  }

  clearedPayload(roomId: string): NextHandReadyStatePayload {
    return {
      roomId,
      eligiblePlayers: [],
      readyCount: 0,
      requiredCount: 0,
    };
  }

  /** Begin ready-check after a hand completes. */
  onHandCompleted(roomId: string): NextHandReadyStatePayload {
    this.phaseActive.add(roomId);
    this.readyByRoom.set(roomId, new Set());
    return this.buildPayload(roomId);
  }

  /** Recompute eligible set and prune stale ready flags (rebuy, disconnect, leave). */
  onEligibilityChanged(roomId: string): NextHandReadyStatePayload | null {
    if (!this.phaseActive.has(roomId)) {
      return null;
    }
    this.pruneReadySet(roomId);
    return this.buildPayload(roomId);
  }

  markReady(
    roomId: string,
    playerId: string,
  ): { readonly payload: NextHandReadyStatePayload; readonly shouldStart: boolean } {
    if (!this.phaseActive.has(roomId)) {
      throw new GameOrchestrationError(
        'NEXT_HAND_NOT_WAITING',
        'Next hand is not waiting for ready players',
      );
    }

    const eligibleIds = new Set(
      this.getEligible(roomId).map((entry) => entry.playerId),
    );
    if (!eligibleIds.has(playerId)) {
      throw new GameOrchestrationError(
        'NOT_ELIGIBLE_FOR_READY',
        'Player is not eligible to ready up for the next hand',
      );
    }

    const ready = this.readyByRoom.get(roomId) ?? new Set<string>();
    ready.add(playerId);
    this.readyByRoom.set(roomId, ready);

    const payload = this.buildPayload(roomId);
    const shouldStart =
      payload.requiredCount >= 2 &&
      payload.readyCount >= payload.requiredCount;
    return { payload, shouldStart };
  }

  buildPayload(roomId: string): NextHandReadyStatePayload {
    const room = this.roomService.getRoom(roomId);
    if (room == null) {
      return this.clearedPayload(roomId);
    }

    const state = this.resolveTableState(roomId);
    const eligible = this.getEligible(roomId, room, state);
    const ready = this.readyByRoom.get(roomId) ?? new Set<string>();

    const eligiblePlayers = eligible.map((entry) => {
      const member = room.players.find((p) => p.playerId === entry.playerId);
      return {
        playerId: entry.playerId,
        nickname: member?.nickname ?? 'Player',
        seatIndex: entry.seatIndex,
        isReady: ready.has(entry.playerId),
      };
    });

    return {
      roomId,
      eligiblePlayers,
      readyCount: eligiblePlayers.filter((p) => p.isReady).length,
      requiredCount: eligiblePlayers.length,
    };
  }

  private getEligible(
    roomId: string,
    room = this.roomService.getRoom(roomId),
    state = this.resolveTableState(roomId),
  ) {
    if (room == null) {
      return [];
    }
    return listEligiblePlayersForNextHand(state, room);
  }

  private resolveTableState(roomId: string) {
    const room = this.roomService.getRoom(roomId);
    if (room == null) {
      throw new GameOrchestrationError('ROOM_NOT_FOUND', 'Room not found');
    }
    let state =
      this.tableService.getTableState(roomId) ??
      this.tableService.ensureTableForRoom(room);
    state = syncTableToRoom(room, state);
    return applySeatEligibility(state);
  }

  private pruneReadySet(roomId: string): void {
    const eligibleIds = new Set(
      this.getEligible(roomId).map((entry) => entry.playerId),
    );
    const ready = this.readyByRoom.get(roomId);
    if (ready == null) {
      return;
    }
    for (const playerId of [...ready]) {
      if (!eligibleIds.has(playerId)) {
        ready.delete(playerId);
      }
    }
  }
}
