import { describe, expect, it } from 'vitest';

import { applyAction } from './actions';
import {
  CoreGameState,
  createInitialGameState,
  createSeededRandom,
  getAvailableActions,
  startHand,
} from '../index';

const rng = createSeededRandom('phase4b-available-actions');

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

  const patched: CoreGameState = Object.freeze({
    ...base,
    table: Object.freeze({ ...base.table, dealerSeatIndex: 5 }),
  });

  return startHand(patched, { rng });
}

describe('getAvailableActions', () => {
  it('returns disabled bundle when out of turn', () => {
    const g = sixMaxThreeWay();
    const utgSeat = g.table.activeSeatIndex!;
    const wrongSeat = (utgSeat + 1) % g.table.maxSeats;
    const wrong = getAvailableActions(g, wrongSeat);
    expect(wrong.canFold).toBe(false);
    expect(wrong.canRaise).toBe(false);
    expect(wrong.canAllIn).toBe(false);

    const ok = getAvailableActions(g, utgSeat);
    expect(ok.canFold).toBe(true);
    expect(ok.canRaise).toBe(true);
    expect(ok.canAllIn).toBe(true);
  });

  it('facing big blind allows call/fold but not check', () => {
    const g = sixMaxThreeWay();
    const seat = g.table.activeSeatIndex!;
    const a = getAvailableActions(g, seat);
    expect(a.canCheck).toBe(false);
    expect(a.canCall).toBe(true);
    expect(a.callAmount).toBe(10);
  });

  it('lets BB check once action returns with no outstanding bet', () => {
    let g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    g = applyAction(g, utg, { kind: 'call' });

    const sbSeat = g.table.activeSeatIndex!;
    g = applyAction(g, sbSeat, { kind: 'call' });

    const bbSeat = g.table.activeSeatIndex!;
    const bb = getAvailableActions(g, bbSeat);
    expect(bb.canCheck).toBe(true);
    expect(bb.canCall).toBe(false);
  });

  it('computes min/max raise totals against BB level', () => {
    const g = sixMaxThreeWay();
    const seat = g.table.activeSeatIndex!;
    const a = getAvailableActions(g, seat);
    expect(a.minRaise).toBe(g.hand!.currentBet + g.hand!.minRaise);
    expect(a.maxRaise).toBe(g.playersById.utg!.currentBet + g.playersById.utg!.chips);
  });

  it('disables raising when seat is flagged raise-frozen', () => {
    const g = sixMaxThreeWay();
    const hero = g.table.activeSeatIndex!;
    const pid = g.table.seats[hero]!.playerId!;
    const player = g.playersById[pid]!;

    const patched: CoreGameState = Object.freeze({
      ...g,
      table: Object.freeze({
        ...g.table,
        activeSeatIndex: hero,
      }),
      playersById: Object.freeze({
        ...g.playersById,
        [pid]: Object.freeze({
          ...player,
          currentBet: g.hand!.currentBet - 12,
        }),
      }),
      hand: Object.freeze({
        ...g.hand!,
        raiseFrozenSeatIndexes: Object.freeze([hero]),
      }),
    });

    const a = getAvailableActions(patched, hero);
    expect(a.canCall).toBe(true);
    expect(a.canRaise).toBe(false);
    expect(a.callAmount).toBe(12);
  });
});
