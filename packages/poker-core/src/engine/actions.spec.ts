import { describe, expect, it } from 'vitest';

import { applyAction } from './actions';
import {
  CannotCallError,
  CannotCheckError,
  CannotRaiseError,
  CoreGameState,
  createInitialGameState,
  createSeededRandom,
  InsufficientChipsError,
  InvalidActionError,
  isBettingRoundComplete,
  OutOfTurnError,
  startHand,
} from '../index';

const rng = createSeededRandom('phase4b-actions');

function huStarted(): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'hu',
      maxSeats: 4,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [
      { playerId: 'sb', seatIndex: 0, startingChips: 100 },
      { playerId: 'bb', seatIndex: 3, startingChips: 100 },
    ],
  });

  // Previous button at seat 3 so rotation moves button to seat 0 (SB acts first heads-up).
  const patched = Object.freeze({
    ...base,
    table: Object.freeze({ ...base.table, dealerSeatIndex: 3 }),
  });

  return startHand(patched, { rng });
}

function sixMaxThreeWay(): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 't',
      maxSeats: 6,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [
      { playerId: 'utg', seatIndex: 1, startingChips: 500 },
      { playerId: 'sb', seatIndex: 3, startingChips: 500 },
      { playerId: 'bb', seatIndex: 5, startingChips: 500 },
    ],
  });

  return startHand(
    Object.freeze({
      ...base,
      table: Object.freeze({ ...base.table, dealerSeatIndex: 5 }),
    }),
    { rng },
  );
}

describe('applyAction', () => {
  it('throws OutOfTurnError when seat is wrong', () => {
    const g = huStarted();
    const actor = g.table.activeSeatIndex!;
    const cheat = (actor + 1) % g.table.maxSeats;
    expect(() => applyAction(g, cheat, { kind: 'fold' })).toThrow(OutOfTurnError);
  });

  it('fold marks folded and ends betting when only one remains', () => {
    let g = huStarted();
    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'fold' });

    expect(g.playersById.sb?.hasFolded).toBe(true);
    expect(g.table.activeSeatIndex).toBeNull();
    expect(g.hand?.pots.total).toBe(15);
  });

  it('check advances turn when facing no bet', () => {
    let g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    g = applyAction(g, utg, { kind: 'call' });
    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'call' });

    const bbSeat = g.table.activeSeatIndex!;
    const next = applyAction(g, bbSeat, { kind: 'check' });

    expect(next.playersById.bb?.currentBet).toBe(10);
    expect(next.hand?.actedSeatIndexes.includes(bbSeat)).toBe(true);
    expect(isBettingRoundComplete(next)).toBe(true);
    expect(next.table.activeSeatIndex).toBeNull();
  });

  it('cannot check facing a bet', () => {
    const g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    expect(() => applyAction(g, utg, { kind: 'check' })).toThrow(CannotCheckError);
  });

  it('cannot call when nothing to call', () => {
    let g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    g = applyAction(g, utg, { kind: 'call' });
    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'call' });
    const bbSeat = g.table.activeSeatIndex!;
    expect(() => applyAction(g, bbSeat, { kind: 'call' })).toThrow(CannotCallError);
  });

  it('call moves chips into commitments', () => {
    const g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    const chipsBefore = g.playersById.utg!.chips;

    const next = applyAction(g, utg, { kind: 'call' });

    expect(next.playersById.utg?.chips).toBe(chipsBefore - 10);
    expect(next.playersById.utg?.currentBet).toBe(10);
    expect(next.playersById.utg?.totalCommitted).toBe(10);
    expect(next.hand?.pots.total).toBe(25);
  });

  it('short call marks all-in', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 4,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'shorty', seatIndex: 1, startingChips: 7 },
        { playerId: 'deep', seatIndex: 2, startingChips: 500 },
      ],
    });

    // Dealer was seat 2 → button rotates to seat 1 (short stack is SB / first actor HU).
    const started = startHand(
      Object.freeze({
        ...base,
        table: Object.freeze({ ...base.table, dealerSeatIndex: 2 }),
      }),
      { rng },
    );

    const actor = started.table.activeSeatIndex!;
    expect(started.table.seats[actor]?.playerId).toBe('shorty');

    const next = applyAction(started, actor, { kind: 'call' });

    expect(next.playersById.shorty?.isAllIn).toBe(true);
    expect(next.playersById.shorty?.chips).toBe(0);
  });

  it('raise updates hand ceiling and aggression meta', () => {
    const g = sixMaxThreeWay();
    const utgSeat = g.table.activeSeatIndex!;
    const target = g.hand!.currentBet + g.hand!.minRaise;

    const next = applyAction(g, utgSeat, { kind: 'raise', amount: target });

    expect(next.hand?.currentBet).toBe(target);
    expect(next.hand?.lastAggressorSeatIndex).toBe(utgSeat);
    expect(next.hand?.lastRaiseAmount).toBe(g.hand!.minRaise);
    expect(next.hand?.actedSeatIndexes).toEqual([utgSeat]);
  });

  it('raise below minimum throws CannotRaiseError', () => {
    const g = sixMaxThreeWay();
    const utgSeat = g.table.activeSeatIndex!;
    expect(() =>
      applyAction(g, utgSeat, {
        kind: 'raise',
        amount: g.hand!.currentBet + g.hand!.minRaise - 1,
      }),
    ).toThrow(CannotRaiseError);
  });

  it('raise beyond stack throws InsufficientChipsError', () => {
    const g = sixMaxThreeWay();
    const utgSeat = g.table.activeSeatIndex!;
    const badTarget = g.playersById.utg!.currentBet + g.playersById.utg!.chips + 50;
    expect(() =>
      applyAction(g, utgSeat, { kind: 'raise', amount: badTarget }),
    ).toThrow(InsufficientChipsError);
  });

  it('all-in commits entire stack', () => {
    const g = huStarted();
    const sbSeat = g.table.activeSeatIndex!;
    const next = applyAction(g, sbSeat, { kind: 'allin' });

    expect(next.playersById.sb?.chips).toBe(0);
    expect(next.playersById.sb?.isAllIn).toBe(true);
    expect(next.playersById.sb?.currentBet).toBeGreaterThan(g.playersById.sb!.currentBet);
  });

  it('all-in with no remaining chips throws InvalidActionError', () => {
    const g = huStarted();
    const actor = g.table.activeSeatIndex!;
    const cheat: CoreGameState = Object.freeze({
      ...g,
      table: Object.freeze({ ...g.table, activeSeatIndex: actor }),
      playersById: Object.freeze({
        ...g.playersById,
        sb: Object.freeze({
          ...g.playersById.sb!,
          chips: 0,
          isAllIn: false,
        }),
      }),
    });

    expect(() => applyAction(cheat, actor, { kind: 'allin' })).toThrow(
      InvalidActionError,
    );
  });

  it('folded player cannot act again', () => {
    let g = huStarted();
    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'fold' });

    // Betting closed — activeSeatIndex cleared — further attempts are out of turn.
    expect(() => applyAction(g, sbSeat, { kind: 'check' })).toThrow(OutOfTurnError);
  });

  it('does not mutate the incoming snapshot', () => {
    const g = huStarted();
    const actor = g.table.activeSeatIndex!;
    const chipsBefore = g.playersById.sb!.chips;

    applyAction(g, actor, { kind: 'call' });

    expect(g.playersById.sb!.chips).toBe(chipsBefore);
    expect(g.hand?.pots.total).toBe(15);
  });
});
