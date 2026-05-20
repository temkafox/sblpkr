import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialGameState,
  createSeededRandom,
  startHand,
} from '@neonpoker/poker-core';
import { HandHistoryPayloadSchema } from '@neonpoker/shared';

import type { MutableInternalRoom } from '../room/room.types';
import {
  HandHistoryService,
  handHistoryPayloadIsPublic,
} from './hand-history.service';
import { progressGameState } from './game-progress';

function sampleRoom(): MutableInternalRoom {
  return {
    roomId: 'room-hh',
    code: 'HH1234',
    createdAt: new Date(),
    maxSeats: 6,
    status: 'playing',
    hostPlayerId: 'p0',
    players: [
      {
        playerId: 'p0',
        nickname: 'Alpha',
        seatIndex: 0,
        socketId: 'sock-0',
      },
      {
        playerId: 'p1',
        nickname: 'Beta',
        seatIndex: 1,
        socketId: 'sock-1',
      },
    ],
  };
}

function huTable(): ReturnType<typeof createInitialGameState> {
  return createInitialGameState({
    table: {
      tableId: 'room-hh',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
    },
    players: [
      { playerId: 'p0', seatIndex: 0, startingChips: 200 },
      { playerId: 'p1', seatIndex: 1, startingChips: 200 },
    ],
  });
}

describe('HandHistoryService', () => {
  const rng = createSeededRandom('hand-history-spec');

  it('appends blind entries on hand start', () => {
    const svc = new HandHistoryService();
    const room = sampleRoom();
    const started = startHand(huTable(), { rng });

    svc.onHandStarted(room, started);
    const payload = HandHistoryPayloadSchema.parse(
      svc.buildPayload(room.roomId),
    );

    expect(payload.handNumber).toBe(1);
    expect(payload.handId).toBe(started.hand!.handId);
    const preflop = payload.streets.find((s) => s.street === 'PRE-FLOP');
    expect(preflop?.entries.some((e) => e.text.includes('small blind'))).toBe(
      true,
    );
    expect(preflop?.entries.some((e) => e.text.includes('big blind'))).toBe(
      true,
    );
    expect(handHistoryPayloadIsPublic(payload)).toBe(true);
    expect(JSON.stringify(payload).includes('deck')).toBe(false);
    expect(JSON.stringify(payload).includes('holeCards')).toBe(false);
  });

  it('appends player action entries with amounts', () => {
    const svc = new HandHistoryService();
    const room = sampleRoom();
    let state = startHand(huTable(), { rng });
    svc.onHandStarted(room, state);

    const actor = state.table.activeSeatIndex!;
    const before = state;
    state = applyAction(state, actor, { kind: 'raise', amount: 8 });
    svc.onPlayerAction(room, state, actor, { kind: 'raise', amount: 8 });
    const progressed = progressGameState(state);
    svc.onProgress(
      room,
      before,
      progressed.state,
      progressed.showdownResult,
      progressed.isFoldWin,
    );

    const payload = svc.buildPayload(room.roomId);
    const text = payload.streets.flatMap((s) => s.entries.map((e) => e.text));
    expect(text.some((t) => t.includes('raises to $8'))).toBe(true);
  });

  it('appends board and result on all-in call runout', () => {
    const svc = new HandHistoryService();
    const room = sampleRoom();
    let state = startHand(huTable(), { rng });
    svc.onHandStarted(room, state);

    const sb = state.table.smallBlindSeatIndex;
    const bb = state.table.bigBlindSeatIndex;
    const before = state;
    state = applyAction(state, sb, { kind: 'allin' });
    svc.onPlayerAction(room, state, sb, { kind: 'allin' });
    state = applyAction(state, bb, { kind: 'call' });
    svc.onPlayerAction(room, state, bb, { kind: 'call' });
    const progressed = progressGameState(state);
    svc.onProgress(
      room,
      before,
      progressed.state,
      progressed.showdownResult,
      progressed.isFoldWin,
    );

    const payload = svc.buildPayload(room.roomId);
    const text = payload.streets.flatMap((s) => s.entries.map((e) => e.text));
    expect(text.some((t) => t.startsWith('Flop:'))).toBe(true);
    expect(text.some((t) => t.includes('Hand complete'))).toBe(true);
    expect(text.some((t) => t.includes('wins'))).toBe(true);
  });

  it('appends fold-win result without board', () => {
    const svc = new HandHistoryService();
    const room = sampleRoom();
    let state = startHand(huTable(), { rng });
    svc.onHandStarted(room, state);

    const folder = state.table.activeSeatIndex!;
    const before = state;
    state = applyAction(state, folder, { kind: 'fold' });
    svc.onPlayerAction(room, state, folder, { kind: 'fold' });
    const progressed = progressGameState(state);
    svc.onProgress(
      room,
      before,
      progressed.state,
      progressed.showdownResult,
      progressed.isFoldWin,
    );

    const payload = svc.buildPayload(room.roomId);
    const text = payload.streets.flatMap((s) => s.entries.map((e) => e.text));
    expect(text.some((t) => t.includes('folds'))).toBe(true);
    expect(text.some((t) => t.includes('wins'))).toBe(true);
    expect(text.some((t) => t.startsWith('Flop:'))).toBe(false);
  });

  it('appends rebuy entry', () => {
    const svc = new HandHistoryService();
    const room = sampleRoom();
    svc.onRebuy(room, 1, 200);
    const payload = svc.buildPayload(room.roomId);
    expect(payload.streets[0]?.entries[0]?.text).toMatch(/Beta rebuy \$200/);
  });
});
