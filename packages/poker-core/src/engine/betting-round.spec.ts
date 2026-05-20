import { describe, expect, it } from 'vitest';

import { applyAction } from './actions';
import {
  CoreGameState,
  createInitialGameState,
  createSeededRandom,
  isBettingRoundComplete,
  needsToAct,
  startHand,
} from '../index';

const rng = createSeededRandom('phase4b-betting-round');

function huStartedSmallBlinds(): CoreGameState {
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

describe('betting round', () => {
  it('is incomplete while someone still needs to act', () => {
    const g = sixMaxThreeWay();
    expect(isBettingRoundComplete(g)).toBe(false);
    expect(needsToAct(g, g.table.activeSeatIndex!)).toBe(true);
  });

  it('completes when everyone folds except one', () => {
    let g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    g = applyAction(g, utg, { kind: 'fold' });

    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'fold' });

    expect(isBettingRoundComplete(g)).toBe(true);
    expect(g.table.activeSeatIndex).toBeNull();
  });

  it('completes when every contestant is all-in', () => {
    let g = huStartedSmallBlinds();

    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'allin' });

    const bbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, bbSeat, { kind: 'allin' });

    expect(g.playersById.sb?.isAllIn && g.playersById.bb?.isAllIn).toBe(true);
    expect(isBettingRoundComplete(g)).toBe(true);
  });

  it('completes after checks once all bets matched', () => {
    let g = sixMaxThreeWay();

    const utgSeat = g.table.activeSeatIndex!;
    g = applyAction(g, utgSeat, { kind: 'call' });

    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'call' });

    const bbSeat = g.table.activeSeatIndex!;
    expect(needsToAct(g, bbSeat)).toBe(true);

    g = applyAction(g, bbSeat, { kind: 'check' });

    expect(isBettingRoundComplete(g)).toBe(true);
    expect(g.table.activeSeatIndex).toBeNull();
  });

  it('raise clears acted seats except aggressor until others respond', () => {
    let g = sixMaxThreeWay();
    const utgSeat = g.table.activeSeatIndex!;
    const target = g.hand!.currentBet + g.hand!.minRaise;

    g = applyAction(g, utgSeat, { kind: 'raise', amount: target });

    expect(g.hand?.actedSeatIndexes).toEqual([utgSeat]);
    expect(needsToAct(g, g.table.smallBlindSeatIndex)).toBe(true);
    expect(isBettingRoundComplete(g)).toBe(false);
  });
});
