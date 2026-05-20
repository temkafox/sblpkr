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

    expect(view0.seats[0]!.holeCards).toHaveLength(2);
    expect(view0.seats[1]!.holeCards).toBeNull();
    expect(view1.seats[1]!.holeCards).toHaveLength(2);
    expect(view1.seats[0]!.holeCards).toBeNull();
    expect(containsPrivateEngineFields(view0)).toBe(false);
  });

  it('never includes deck in mapped payloads', () => {
    const state = huState();
    const serialized = JSON.stringify(toPlayerGameState(state, 0, sampleRoom()));
    expect(serialized.includes('deck')).toBe(false);
    expect(serialized.includes('playersById')).toBe(false);
  });

  it('includes board and pot summary', () => {
    let state = huState();
    const seat = state.table.activeSeatIndex!;
    state = applyAction(state, seat, { kind: 'call' });

    const view = toPlayerGameState(state, seat, sampleRoom());
    expect(view.street).toBe('PRE-FLOP');
    expect(view.pot.total).toBeGreaterThan(0);
  });
});
