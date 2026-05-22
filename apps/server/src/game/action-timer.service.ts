import { Injectable } from '@nestjs/common';
import type { CoreGameState, SeatIndex } from '@neonpoker/poker-core';
import { getAvailableActions } from '@neonpoker/poker-core';
import type { PlayerActionIntent } from '@neonpoker/shared';
import type { Server } from 'socket.io';

import { RoomService } from '../room/room.service';
import { GameBroadcastService } from './game-broadcast';
import { GameService } from './game.service';
import { HandHistoryService } from './hand-history.service';

@Injectable()
export class ActionTimerService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly gameBroadcast: GameBroadcastService,
    private readonly handHistory: HandHistoryService,
  ) {}

  static forTest(options: {
    readonly roomService: RoomService;
    readonly gameService: GameService;
    readonly gameBroadcast: GameBroadcastService;
    readonly handHistory: HandHistoryService;
  }): ActionTimerService {
    return new ActionTimerService(
      options.roomService,
      options.gameService,
      options.gameBroadcast,
      options.handHistory,
    );
  }

  clearTimer(roomId: string): void {
    const existing = this.timers.get(roomId);
    if (existing != null) {
      clearTimeout(existing);
      this.timers.delete(roomId);
    }
    this.roomService.setActionDeadline(roomId, null);
  }

  /** Align server deadline + timeout with current game state; rebroadcast snapshots. */
  syncTimer(server: Server, roomId: string): void {
    this.clearTimer(roomId);

    const room = this.roomService.getRoom(roomId);
    if (room == null) {
      return;
    }

    let state: CoreGameState;
    try {
      state = this.gameService.getGameState(roomId);
    } catch {
      return;
    }

    const hand = state.hand;
    if (
      hand == null ||
      hand.isComplete ||
      hand.showdownReady ||
      state.table.activeSeatIndex == null
    ) {
      this.gameBroadcast.emitGameStateToRoom(server, roomId, state);
      return;
    }

    const activeSeat = state.table.activeSeatIndex;
    let actions;
    try {
      actions = getAvailableActions(state, activeSeat);
    } catch {
      this.gameBroadcast.emitGameStateToRoom(server, roomId, state);
      return;
    }

    if (!actions.canFold && !actions.canCheck && !actions.canCall && !actions.canRaise && !actions.canAllIn) {
      this.gameBroadcast.emitGameStateToRoom(server, roomId, state);
      return;
    }

    const timeoutMs = room.settings.actionTimeoutSeconds * 1000;
    const deadlineAt = Date.now() + timeoutMs;
    const handId = hand.handId;
    this.roomService.setActionDeadline(roomId, deadlineAt);

    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      void this.onTimeout(server, roomId, activeSeat, handId);
    }, timeoutMs);
    this.timers.set(roomId, timer);

    this.gameBroadcast.emitGameStateToRoom(server, roomId, state);
  }

  private async onTimeout(
    server: Server,
    roomId: string,
    expectedSeat: SeatIndex,
    expectedHandId: string,
  ): Promise<void> {
    this.roomService.setActionDeadline(roomId, null);

    const room = this.roomService.getRoom(roomId);
    if (room == null) {
      return;
    }

    let state: CoreGameState;
    try {
      state = this.gameService.getGameState(roomId);
    } catch {
      return;
    }

    const hand = state.hand;
    if (
      hand == null ||
      hand.isComplete ||
      hand.showdownReady ||
      hand.handId !== expectedHandId ||
      state.table.activeSeatIndex !== expectedSeat
    ) {
      return;
    }

    let actions;
    try {
      actions = getAvailableActions(state, expectedSeat);
    } catch {
      return;
    }

    const intent: PlayerActionIntent = actions.canCheck
      ? { kind: 'check' }
      : { kind: 'fold' };

    try {
      const next = this.gameService.applyPlayerAction(
        roomId,
        expectedSeat,
        intent,
        { fromTimeout: true },
      );
      this.handHistory.onTimeoutAction(
        room,
        next,
        expectedSeat,
        intent.kind === 'check' ? 'check' : 'fold',
      );
      this.gameBroadcast.emitGameUpdateToRoom(server, roomId, next);
      this.syncTimer(server, roomId);
    } catch {
      /* state changed — ignore */
    }
  }
}
