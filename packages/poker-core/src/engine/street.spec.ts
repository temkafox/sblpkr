import { describe, expect, it } from 'vitest';

import { applyAction } from './actions';
import {
  advanceStreet,
  canAdvanceStreet,
  CoreGameState,
  createInitialGameState,
  createSeededRandom,
  getFirstToActPostflop,
  InvalidTableStateError,
  startHand,
} from '../index';

const rng = createSeededRandom('phase4c-street');

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

function fourMaxPot(): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'four',
      maxSeats: 6,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [
      { playerId: 's1', seatIndex: 1, startingChips: 500 },
      { playerId: 's2', seatIndex: 2, startingChips: 500 },
      { playerId: 's3', seatIndex: 3, startingChips: 500 },
      { playerId: 's5', seatIndex: 5, startingChips: 500 },
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

function completeStreetChecks(g: CoreGameState): CoreGameState {
  let s = g;
  while (!canAdvanceStreet(s)) {
    const seat = s.table.activeSeatIndex!;
    const pid = s.table.seats[seat]!.playerId!;
    const facing =
      s.hand!.currentBet - s.playersById[pid]!.currentBet;
    if (facing <= 0) {
      s = applyAction(s, seat, { kind: 'check' });
    } else {
      s = applyAction(s, seat, { kind: 'call' });
    }
  }
  return s;
}

describe('advanceStreet', () => {
  it('throws before the betting round completes', () => {
    expect(() => advanceStreet(sixMaxThreeWay())).toThrow(InvalidTableStateError);
  });

  it('preflop → flop peels exactly three cards', () => {
    let g = sixMaxThreeWay();
    const deckLenBefore = g.hand!.deck.length;

    g = completeStreetChecks(g);
    expect(canAdvanceStreet(g)).toBe(true);

    const flop = advanceStreet(g);

    expect(flop.hand?.street).toBe('FLOP');
    expect(flop.hand?.boardCards).toHaveLength(3);
    expect(flop.hand?.deck.length).toBe(deckLenBefore - 3);
    expect(flop.playersById.utg?.currentBet).toBe(0);
    expect(flop.playersById.utg?.totalCommitted).toBe(g.playersById.utg!.totalCommitted);
    expect(flop.hand?.pots.total).toBeGreaterThan(0);
    expect(flop.hand?.currentBet).toBe(0);
    expect(flop.hand?.actedSeatIndexes).toHaveLength(0);
    expect(flop.hand?.raiseFrozenSeatIndexes).toHaveLength(0);
    expect(flop.hand?.lastAggressorSeatIndex).toBeNull();
    expect(flop.hand?.minRaise).toBe(flop.table.bigBlind);
  });

  it('walks flop → turn → river → showdown-ready without evaluating winners', () => {
    let g = sixMaxThreeWay();
    g = completeStreetChecks(g);

    let s = advanceStreet(g);
    expect(s.hand?.street).toBe('FLOP');

    s = completeStreetChecks(s);
    s = advanceStreet(s);
    expect(s.hand?.street).toBe('TURN');
    expect(s.hand?.boardCards).toHaveLength(4);

    s = completeStreetChecks(s);
    s = advanceStreet(s);
    expect(s.hand?.street).toBe('RIVER');
    expect(s.hand?.boardCards).toHaveLength(5);

    s = completeStreetChecks(s);
    s = advanceStreet(s);
    expect(s.hand?.street).toBe('SHOWDOWN');
    expect(s.hand?.showdownReady).toBe(true);
    expect(s.hand?.isComplete).toBe(false);
    expect(s.table.activeSeatIndex).toBeNull();
  });

  it('fold winner marks hand complete without paying pot', () => {
    let g = sixMaxThreeWay();
    const utg = g.table.activeSeatIndex!;
    g = applyAction(g, utg, { kind: 'fold' });

    const sb = g.table.activeSeatIndex!;
    g = applyAction(g, sb, { kind: 'fold' });

    expect(canAdvanceStreet(g)).toBe(true);
    const done = advanceStreet(g);

    expect(done.hand?.isComplete).toBe(true);
    expect(done.hand?.showdownReady).toBe(false);
    expect(done.table.activeSeatIndex).toBeNull();
  });

  it('runs out the board when everyone left is all-in', () => {
    const g = huThreeWayAllInPreflop();
    expect(canAdvanceStreet(g)).toBe(true);

    const riverish = advanceStreet(g);

    expect(riverish.hand?.boardCards).toHaveLength(5);
    expect(riverish.hand?.street).toBe('SHOWDOWN');
    expect(riverish.hand?.showdownReady).toBe(true);
    expect(riverish.table.activeSeatIndex).toBeNull();
    expect(
      riverish.playersById.a?.currentBet === 0 &&
        riverish.playersById.b?.currentBet === 0 &&
        riverish.playersById.c?.currentBet === 0,
    ).toBe(true);
  });

  it('selects first postflop actor clockwise from dealer skipping folders', () => {
    let g = fourMaxPot();

    const utgSeat = g.table.activeSeatIndex!;
    g = applyAction(g, utgSeat, { kind: 'fold' });

    const closed = completeStreetChecks(g);

    const flop = advanceStreet(closed);
    const dealer = flop.table.dealerSeatIndex;

    expect(flop.table.activeSeatIndex).toBe(getFirstToActPostflop(flop));

    let expected: number | null = null;
    for (let step = 1; step <= flop.table.maxSeats; step++) {
      const seat = (dealer + step) % flop.table.maxSeats;
      const pid = flop.table.seats[seat]?.playerId;
      if (!pid) continue;
      const pl = flop.playersById[pid];
      if (
        pl &&
        !pl.hasFolded &&
        !pl.isSittingOut &&
        !pl.isAllIn
      ) {
        expected = seat;
        break;
      }
    }
    expect(flop.table.activeSeatIndex).toBe(expected);
    expect(flop.table.activeSeatIndex).not.toBe(utgSeat);
  });

  it('does not mutate the incoming snapshot arrays', () => {
    let g = sixMaxThreeWay();
    g = completeStreetChecks(g);

    const deckRef = g.hand!.deck;
    const boardRef = g.hand!.boardCards;

    const frozen = Object.freeze({
      ...g,
      table: Object.freeze({ ...g.table }),
      playersById: Object.freeze({ ...g.playersById }),
      hand:
        g.hand === null ? null : Object.freeze({ ...g.hand }),
    }) as CoreGameState;

    advanceStreet(frozen);

    expect(frozen.hand?.deck).toBe(deckRef);
    expect(frozen.hand?.boardCards).toBe(boardRef);
  });
});

function huThreeWayAllInPreflop(): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'runout',
      maxSeats: 6,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [
      { playerId: 'a', seatIndex: 1, startingChips: 100 },
      { playerId: 'b', seatIndex: 3, startingChips: 100 },
      { playerId: 'c', seatIndex: 5, startingChips: 100 },
    ],
  });

  let g = startHand(
    Object.freeze({
      ...base,
      table: Object.freeze({ ...base.table, dealerSeatIndex: 5 }),
    }),
    { rng },
  );

  while (g.table.activeSeatIndex != null) {
    g = applyAction(g, g.table.activeSeatIndex!, { kind: 'allin' });
  }

  return g;
}

describe('board uniqueness vs hole cards', () => {
  it('keeps combined hole + board cards unique after runout', () => {
    const g = huThreeWayAllInPreflop();

    const holeKeys = new Set<string>();
    for (const pid of Object.keys(g.playersById)) {
      for (const c of g.playersById[pid]!.holeCards) {
        holeKeys.add(`${c.r}:${c.s}`);
      }
    }

    const runout = advanceStreet(g);
    const boardKeys = runout.hand!.boardCards.map((c) => `${c.r}:${c.s}`);
    expect(new Set(boardKeys).size).toBe(boardKeys.length);

    for (const key of boardKeys) {
      expect(holeKeys.has(key)).toBe(false);
    }
  });
});
