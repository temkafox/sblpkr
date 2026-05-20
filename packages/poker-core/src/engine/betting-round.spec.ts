import { describe, expect, it } from 'vitest';

import { applyAction } from './actions';
import { advanceStreet, canAdvanceStreet } from './street';
import {
  CoreGameState,
  createInitialGameState,
  createSeededRandom,
  canContinueBetting,
  getAvailableActions,
  getNonFoldedSeatIndexes,
  isBettingRoundComplete,
  needsToAct,
  resolveShowdown,
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

function huUnequalStacks(): CoreGameState {
  const base = createInitialGameState({
    table: {
      tableId: 'hu-unequal',
      maxSeats: 6,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: [
      { playerId: 'short', seatIndex: 0, startingChips: 200 },
      { playerId: 'deep', seatIndex: 3, startingChips: 500 },
    ],
  });

  return startHand(
    Object.freeze({
      ...base,
      table: Object.freeze({ ...base.table, dealerSeatIndex: 3 }),
    }),
    { rng: createSeededRandom('hu-unequal-ai') },
  );
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

describe('all-in at zero chips during active hand', () => {
  it('keeps all-in player as contestant and off the action clock', () => {
    let g = huStartedSmallBlinds();
    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;

    g = applyAction(g, sbSeat, { kind: 'allin' });

    const sb = g.playersById.sb!;
    expect(sb.chips).toBe(0);
    expect(sb.isAllIn).toBe(true);
    expect(getNonFoldedSeatIndexes(g)).toContain(sbSeat);
    expect(needsToAct(g, sbSeat)).toBe(false);
    expect(g.table.activeSeatIndex).toBe(bbSeat);
  });

  it('lets opponent call an all-in and run out to showdown', () => {
    let g = huStartedSmallBlinds();
    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;

    g = applyAction(g, sbSeat, { kind: 'allin' });
    expect(getAvailableActions(g, bbSeat).canCall).toBe(true);

    g = applyAction(g, bbSeat, { kind: 'call' });
    g = advanceStreet(g);

    expect(g.hand?.showdownReady).toBe(true);
    expect(g.hand?.boardCards.length).toBe(5);
    expect(getNonFoldedSeatIndexes(g).length).toBe(2);

    const resolved = resolveShowdown(g);
    expect(resolved.hand?.isComplete).toBe(true);
  });

  it('canContinueBetting is false when only one player can still bet', () => {
    let g = huUnequalStacks();
    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;

    g = applyAction(g, sbSeat, { kind: 'allin' });
    g = applyAction(g, bbSeat, { kind: 'call' });

    expect(canContinueBetting(g)).toBe(false);
    expect(isBettingRoundComplete(g)).toBe(true);
  });

  it('HU: short all-in, deep call with chips behind auto-runs out to SHOWDOWN', () => {
    let g = huUnequalStacks();
    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;
    const shortId = g.table.seats[sbSeat]!.playerId!;
    const deepId = g.table.seats[bbSeat]!.playerId!;

    g = applyAction(g, sbSeat, { kind: 'allin' });
    expect(g.playersById[shortId]!.chips).toBe(0);
    expect(g.playersById[shortId]!.isAllIn).toBe(true);

    g = applyAction(g, bbSeat, { kind: 'call' });
    expect(g.playersById[deepId]!.chips).toBeGreaterThan(0);
    expect(g.playersById[deepId]!.isAllIn).toBe(false);
    expect(g.table.activeSeatIndex).toBeNull();
    expect(canContinueBetting(g)).toBe(false);

    g = advanceStreet(g);
    expect(g.hand?.street).toBe('SHOWDOWN');
    expect(g.hand?.showdownReady).toBe(true);
    expect(g.hand?.boardCards.length).toBe(5);
    expect(g.table.activeSeatIndex).toBeNull();

    const actions = getAvailableActions(g, bbSeat);
    expect(actions.canCheck).toBe(false);
    expect(actions.canRaise).toBe(false);
    expect(actions.canCall).toBe(false);
  });

  it('turn all-in call runs out river and showdown without further betting', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'turn-ai',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'short', seatIndex: 0, startingChips: 200 },
        { playerId: 'deep', seatIndex: 1, startingChips: 500 },
      ],
    });

    let g = startHand(
      Object.freeze({
        ...base,
        table: Object.freeze({ ...base.table, dealerSeatIndex: 1 }),
      }),
      { rng: createSeededRandom('turn-ai-runout') },
    );

    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;

    while (g.hand?.street === 'PRE-FLOP' && g.table.activeSeatIndex != null) {
      const seat = g.table.activeSeatIndex;
      const acts = getAvailableActions(g, seat);
      g = applyAction(
        g,
        seat,
        acts.canCheck ? { kind: 'check' } : { kind: 'call' },
      );
    }
    if (canAdvanceStreet(g)) {
      g = advanceStreet(g);
    }

    while (g.hand?.street === 'FLOP' && g.table.activeSeatIndex != null) {
      const seat = g.table.activeSeatIndex;
      g = applyAction(g, seat, { kind: 'check' });
    }
    if (canAdvanceStreet(g)) {
      g = advanceStreet(g);
    }

    expect(g.hand?.street).toBe('TURN');
    expect(g.hand?.boardCards.length).toBe(4);

    const allInSeat = g.table.activeSeatIndex!;
    const callerSeat = allInSeat === sbSeat ? bbSeat : sbSeat;
    g = applyAction(g, allInSeat, { kind: 'allin' });
    g = applyAction(g, callerSeat, { kind: 'call' });

    expect(canContinueBetting(g)).toBe(false);
    expect(isBettingRoundComplete(g)).toBe(true);
    expect(g.table.activeSeatIndex).toBeNull();

    g = advanceStreet(g);
    expect(g.hand?.street).toBe('SHOWDOWN');
    expect(g.hand?.boardCards.length).toBe(5);
    expect(g.table.activeSeatIndex).toBeNull();
    expect(getAvailableActions(g, callerSeat).canCheck).toBe(false);
    expect(getAvailableActions(g, callerSeat).canRaise).toBe(false);
  });

  it('multiway: one all-in and two deep stacks can continue betting', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'mw-ai',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'utg', seatIndex: 1, startingChips: 200 },
        { playerId: 'sb', seatIndex: 3, startingChips: 500 },
        { playerId: 'bb', seatIndex: 5, startingChips: 500 },
      ],
    });

    let g = startHand(
      Object.freeze({
        ...base,
        table: Object.freeze({ ...base.table, dealerSeatIndex: 5 }),
      }),
      { rng: createSeededRandom('mw-ai-continue') },
    );

    const utg = g.table.activeSeatIndex!;
    g = applyAction(g, utg, { kind: 'allin' });

    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;
    g = applyAction(g, sbSeat, { kind: 'call' });

    expect(canContinueBetting(g)).toBe(true);
    expect(needsToAct(g, bbSeat)).toBe(true);
    expect(getAvailableActions(g, bbSeat).canRaise).toBe(true);
  });
});

describe('getNonFoldedSeatIndexes / fold-win vs showdown', () => {
  it('all-in preflop with two players is not a fold win', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'ai-hu',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 's', seatIndex: 0, startingChips: 120 },
        { playerId: 'b', seatIndex: 3, startingChips: 120 },
      ],
    });

    let g = startHand(
      Object.freeze({
        ...base,
        table: Object.freeze({ ...base.table, dealerSeatIndex: 0 }),
      }),
      { rng: createSeededRandom('ai-pf') },
    );

    g = applyAction(g, g.table.smallBlindSeatIndex, { kind: 'allin' });
    g = applyAction(g, g.table.bigBlindSeatIndex, { kind: 'call' });
    g = advanceStreet(g);

    expect(g.hand?.showdownReady).toBe(true);
    expect(g.hand?.boardCards.length).toBe(5);
    expect(getNonFoldedSeatIndexes(g).length).toBe(2);

    const resolved = resolveShowdown(g);
    expect(resolved.hand?.isComplete).toBe(true);
    expect(getNonFoldedSeatIndexes(resolved).length).toBe(2);
  });

  it('fold after opponent all-in leaves one non-folded player', () => {
    const base = createInitialGameState({
      table: {
        tableId: 'ai-fold',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 's', seatIndex: 0, startingChips: 120 },
        { playerId: 'b', seatIndex: 3, startingChips: 120 },
      ],
    });

    let g = startHand(
      Object.freeze({
        ...base,
        table: Object.freeze({ ...base.table, dealerSeatIndex: 0 }),
      }),
      { rng: createSeededRandom('ai-fold') },
    );

    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;
    g = applyAction(g, sbSeat, { kind: 'allin' });
    g = applyAction(g, bbSeat, { kind: 'fold' });

    expect(getNonFoldedSeatIndexes(g).length).toBe(1);
    expect(isBettingRoundComplete(g)).toBe(true);
  });
});
