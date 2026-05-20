import { describe, expect, it } from 'vitest';

import {
  applyAction,
  createInitialGameState,
  createSeededRandom,
  startHand,
} from '@neonpoker/poker-core';
import { PlayerGameStateSchema, PublicGameStateSchema } from '@neonpoker/shared';

import type { MutableInternalRoom } from '../room/room.types';
import {
  containsPrivateEngineFields,
  isFoldWinHand,
  toIdlePlayerGameState,
  toPlayerGameState,
  toPublicGameState,
} from './game-state-view';

function sampleRoom(): MutableInternalRoom {
  return {
    roomId: 'room-1',
    code: 'ABC123',
    createdAt: new Date(),
    maxSeats: 6,
    status: 'waiting',
    hostPlayerId: 'p0',
    players: [
      {
        playerId: 'p0',
        nickname: 'Alpha',
        seatIndex: null,
        socketId: 'sock-0',
      },
      {
        playerId: 'p1',
        nickname: 'Beta',
        seatIndex: null,
        socketId: 'sock-1',
      },
    ],
  };
}

function huState() {
  const base = createInitialGameState({
    table: {
      tableId: 'room-1',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
    },
    players: [
      { playerId: 'p0', seatIndex: 0, startingChips: 200 },
      { playerId: 'p1', seatIndex: 1, startingChips: 200 },
    ],
  });
  return startHand(base, { rng: createSeededRandom('view-test') });
}

describe('game-state-view (Phase 6C2)', () => {
  it('hides all hole card faces in public view', () => {
    const state = huState();
    const view = PublicGameStateSchema.parse(toPublicGameState(state, sampleRoom()));

    expect(view.seats.every((s) => s.holeCards == null)).toBe(true);
    expect(view.seats.some((s) => s.holeCardCount === 2)).toBe(true);
    expect(containsPrivateEngineFields(view)).toBe(false);
    expect('deck' in view).toBe(false);
  });

  it('shows only viewer hole cards in player view', () => {
    const state = huState();
    const room = sampleRoom();

    const view0 = PlayerGameStateSchema.parse(toPlayerGameState(state, 0, room));
    const view1 = PlayerGameStateSchema.parse(toPlayerGameState(state, 1, room));

    expect(view0.viewerSeatIndex).toBe(0);
    expect(view1.viewerSeatIndex).toBe(1);
    expect(view0.seats[0]!.holeCards).toHaveLength(2);
    expect(view0.seats[1]!.holeCards).toBeNull();
    expect(view1.seats[1]!.holeCards).toHaveLength(2);
    expect(view1.seats[0]!.holeCards).toBeNull();
    expect(containsPrivateEngineFields(view0)).toBe(false);
  });

  it('at showdown both viewers see contestant cards but viewerSeatIndex differs', () => {
    let state = huState();
    const p0 = state.playersById.p0!;
    const p1 = state.playersById.p1!;
    state = Object.freeze({
      ...state,
      hand: Object.freeze({
        ...state.hand!,
        isComplete: true,
        showdownReady: true,
        street: 'SHOWDOWN',
      }),
      playersById: Object.freeze({
        p0: Object.freeze({ ...p0, hasFolded: false }),
        p1: Object.freeze({ ...p1, hasFolded: false }),
      }),
    });

    const room = sampleRoom();
    const view0 = PlayerGameStateSchema.parse(toPlayerGameState(state, 0, room));
    const view1 = PlayerGameStateSchema.parse(toPlayerGameState(state, 1, room));

    expect(view0.viewerSeatIndex).toBe(0);
    expect(view1.viewerSeatIndex).toBe(1);
    expect(view0.seats[0]!.holeCards).toHaveLength(2);
    expect(view0.seats[1]!.holeCards).toHaveLength(2);
    expect(view1.seats[0]!.holeCards).toHaveLength(2);
    expect(view1.seats[1]!.holeCards).toHaveLength(2);
  });

  it('never includes deck in mapped payloads', () => {
    const state = huState();
    const serialized = JSON.stringify(toPlayerGameState(state, 0, sampleRoom()));
    expect(serialized.includes('deck')).toBe(false);
    expect(serialized.includes('playersById')).toBe(false);
  });

  it('includes room nicknames on occupied seats', () => {
    const state = huState();
    const room = sampleRoom();

    const view = PlayerGameStateSchema.parse(toPlayerGameState(state, 0, room));

    expect(view.seats[0]!.nickname).toBe('Alpha');
    expect(view.seats[1]!.nickname).toBe('Beta');
  });

  it('includes board and pot summary', () => {
    let state = huState();
    const seat = state.table.activeSeatIndex!;
    state = applyAction(state, seat, { kind: 'call' });

    const view = toPlayerGameState(state, seat, sampleRoom());
    expect(view.street).toBe('PRE-FLOP');
    expect(view.pot.total).toBeGreaterThan(0);
  });

  it('reveals showdown contestant hole cards after hand completes', () => {
    let state = huState();
    const p0 = state.playersById.p0!;
    const p1 = state.playersById.p1!;
    state = Object.freeze({
      ...state,
      hand: Object.freeze({
        ...state.hand!,
        isComplete: true,
        showdownReady: true,
        street: 'SHOWDOWN',
      }),
      playersById: Object.freeze({
        p0: Object.freeze({ ...p0, hasFolded: false }),
        p1: Object.freeze({ ...p1, hasFolded: false }),
      }),
    });

    const room = sampleRoom();
    const view0 = PlayerGameStateSchema.parse(toPlayerGameState(state, 0, room));
    const view1 = PlayerGameStateSchema.parse(toPlayerGameState(state, 1, room));

    expect(view0.handEndKind).toBe('SHOWDOWN');
    expect(view0.seats[0]!.holeCards).toHaveLength(2);
    expect(view0.seats[1]!.holeCards).toHaveLength(2);
    expect(view1.seats[0]!.holeCards).toHaveLength(2);
    expect(view1.seats[1]!.holeCards).toHaveLength(2);
    expect(containsPrivateEngineFields(view0)).toBe(false);
    expect(JSON.stringify(view0).includes('deck')).toBe(false);
  });

  it('does not reveal folded or opponent cards on fold-win completion', () => {
    let state = huState();
    const winner = state.playersById.p0!;
    const folder = state.playersById.p1!;
    state = Object.freeze({
      ...state,
      hand: Object.freeze({
        ...state.hand!,
        isComplete: true,
        showdownReady: true,
        street: 'RIVER',
      }),
      playersById: Object.freeze({
        p0: Object.freeze({ ...winner, hasFolded: false }),
        p1: Object.freeze({ ...folder, hasFolded: true }),
      }),
    });

    expect(isFoldWinHand(state)).toBe(true);

    const view0 = toPlayerGameState(state, 0, sampleRoom());
    expect(view0.handEndKind).toBe('FOLD_WIN');
    expect(view0.seats[0]!.holeCards).toHaveLength(2);
    expect(view0.seats[1]!.holeCards).toBeNull();
    expect(view0.seats[1]!.holeCardCount).toBe(2);
  });

  it('does not reveal hole cards while hand is still in progress', () => {
    const state = huState();
    const view = toPlayerGameState(state, 0, sampleRoom());
    expect(view.handEndKind).toBeNull();
    expect(view.seats[1]!.holeCards).toBeNull();
    expect(view.seats[1]!.holeCardCount).toBe(2);
  });

  it('toIdlePlayerGameState clears active-hand fields', () => {
    const state = huState();
    const room = sampleRoom();
    const idle = PlayerGameStateSchema.parse(toIdlePlayerGameState(state, 0, room));

    expect(idle.handId).toBeNull();
    expect(idle.street).toBeNull();
    expect(idle.boardCards).toHaveLength(0);
    expect(idle.pot.total).toBe(0);
    expect(idle.activeSeatIndex).toBeNull();
    expect(idle.seats[0]!.holeCards).toBeNull();
    expect(idle.seats[0]!.nickname).toBe('Alpha');
  });
});
