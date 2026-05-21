import { describe, expect, it } from 'vitest';

import {
  advanceStreet,
  applyAction,
  canAdvanceStreet,
  createInitialGameState,
  createSeededRandom,
  getAvailableActions,
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
import { progressGameState } from './game-progress';

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
        clientSessionId: 'gv-p0',
        socketId: 'sock-0',
        connectionStatus: 'connected',
      },
      {
        playerId: 'p1',
        nickname: 'Beta',
        seatIndex: null,
        clientSessionId: 'gv-p1',
        socketId: 'sock-1',
        connectionStatus: 'connected',
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

  it('zeros wire seat currentBet after street advance while pot keeps commitments', () => {
    let state = huState();
    const sbIdx = state.table.smallBlindSeatIndex!;
    const bbIdx = state.table.bigBlindSeatIndex!;
    const sbId = state.table.seats[sbIdx]!.playerId!;
    const bbId = state.table.seats[bbIdx]!.playerId!;

    while (!canAdvanceStreet(state)) {
      const seat = state.table.activeSeatIndex!;
      const available = getAvailableActions(state, seat);
      state = applyAction(
        state,
        seat,
        available.canCheck ? { kind: 'check' } : { kind: 'call' },
      );
    }
    state = advanceStreet(state);

    const view = PlayerGameStateSchema.parse(
      toPlayerGameState(state, sbIdx, sampleRoom()),
    );

    expect(view.street).toBe('FLOP');
    expect(view.pot.total).toBeGreaterThan(0);
    expect(view.seats[sbIdx]!.currentBet).toBe(0);
    expect(view.seats[bbIdx]!.currentBet).toBe(0);
    expect(state.playersById[sbId]!.totalCommitted).toBeGreaterThan(0);
    expect(state.playersById[bbId]!.totalCommitted).toBeGreaterThan(0);
    expect(view.seats[sbIdx]!.lastAction?.amount).toBeGreaterThan(0);
  });

  it('exposes lastAction on wire after betting actions', () => {
    let state = huState();
    const actor = state.table.activeSeatIndex!;
    state = applyAction(state, actor, { kind: 'call' });

    const view = PlayerGameStateSchema.parse(toPlayerGameState(state, actor, sampleRoom()));
    const seat = view.seats[actor]!;
    expect(seat.lastAction?.kind).toBe('call');
    expect(seat.lastAction?.amount).toBeGreaterThan(0);
    expect(containsPrivateEngineFields(view)).toBe(false);
    expect(JSON.stringify(view).includes('deck')).toBe(false);
  });

  it('exposes disconnected connectionStatus on wire seats', () => {
    const room = sampleRoom();
    room.players[0]!.connectionStatus = 'disconnected';
    room.players[0]!.socketId = null;

    const view = toPlayerGameState(huState(), 1, room);
    expect(view.seats[0]?.connectionStatus).toBe('disconnected');
    expect(JSON.stringify(view)).not.toContain('socketId');
  });

  it('marks winner seats when hand is complete', () => {
    let state = huState();
    const folder = state.table.activeSeatIndex!;
    state = applyAction(state, folder, { kind: 'fold' });
    const { state: done } = progressGameState(state);
    const winnerSeat = done.table.bigBlindSeatIndex;

    const view = toPlayerGameState(done, folder, sampleRoom());
    expect(view.winnerSeatIndexes).toEqual([winnerSeat]);
    expect(view.seats[winnerSeat]!.isWinner).toBe(true);
    expect(view.seats[folder]!.isWinner).toBe(false);
  });

  it('mid-hand all-in at zero chips is not sitting out on the wire', () => {
    let state = huState();
    const sbSeat = state.table.smallBlindSeatIndex;
    state = applyAction(state, sbSeat, { kind: 'allin' });

    const room = sampleRoom();
    const view = PlayerGameStateSchema.parse(toPlayerGameState(state, sbSeat, room));
    const allInSeat = view.seats[sbSeat]!;

    expect(allInSeat.stack).toBe(0);
    expect(allInSeat.isAllIn).toBe(true);
    expect(allInSeat.isSittingOut).toBe(false);
    expect(view.handComplete).toBe(false);
  });

  it('classifies all-in showdown as SHOWDOWN when both players are non-folded', () => {
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
        boardCards: state.hand!.boardCards.length >= 5
          ? state.hand!.boardCards
          : Object.freeze([
              ...state.hand!.boardCards,
              { r: '2', s: 'c' },
              { r: '3', s: 'd' },
              { r: '4', s: 'h' },
              { r: '5', s: 's' },
              { r: '6', s: 'c' },
            ].slice(0, 5)),
      }),
      playersById: Object.freeze({
        p0: Object.freeze({
          ...p0,
          chips: 0,
          isAllIn: true,
          isSittingOut: true,
          hasFolded: false,
        }),
        p1: Object.freeze({
          ...p1,
          chips: 240,
          isAllIn: true,
          isSittingOut: false,
          hasFolded: false,
        }),
      }),
    }) as typeof state;

    expect(isFoldWinHand(state)).toBe(false);
    const view0 = PlayerGameStateSchema.parse(toPlayerGameState(state, 0, sampleRoom()));
    expect(view0.handEndKind).toBe('SHOWDOWN');
    expect(view0.seats[0]!.holeCards).toHaveLength(2);
    expect(view0.seats[1]!.holeCards).toHaveLength(2);
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

  it('toIdlePlayerGameState reflects rebought chips and clears sit-out', () => {
    const room = sampleRoom();
    let state = huState();
    const p1 = room.players[1]!.playerId;
    state = Object.freeze({
      ...state,
      hand: null,
      playersById: Object.freeze({
        ...state.playersById,
        [p1]: Object.freeze({
          ...state.playersById[p1]!,
          chips: 200,
          isSittingOut: false,
        }),
      }),
    });

    const idle = PlayerGameStateSchema.parse(toIdlePlayerGameState(state, 1, room));
    expect(idle.seats[1]!.stack).toBe(200);
    expect(idle.seats[1]!.isSittingOut).toBe(false);
  });
});
