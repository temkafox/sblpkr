import { describe, expect, it } from 'vitest';
import {
  createInitialGameState,
  createSeededRandom,
  getActiveSeatIndexes,
  getPlayerAtSeat,
  startHand,
} from '@neonpoker/poker-core';

import {
  applySeatEligibility,
  countEligiblePlayers,
} from './table-roster-sync';

function threeSeatTable() {
  return createInitialGameState({
    table: {
      tableId: 'room-1',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
    },
    players: [
      { playerId: 'p0', seatIndex: 0, startingChips: 100 },
      { playerId: 'p1', seatIndex: 1, startingChips: 50 },
      { playerId: 'p2', seatIndex: 2, startingChips: 0 },
    ],
  });
}

describe('applySeatEligibility', () => {
  it('marks zero-stack players sitting out', () => {
    const synced = applySeatEligibility(threeSeatTable());
    expect(synced.playersById.p2!.isSittingOut).toBe(true);
    expect(synced.playersById.p0!.isSittingOut).toBe(false);
    expect(countEligiblePlayers(synced)).toBe(2);
  });
});

describe('startHand with busted player', () => {
  it('does not deal or blind-post a zero-stack seat', () => {
    const base = applySeatEligibility(threeSeatTable());
    expect(getActiveSeatIndexes(base)).toEqual([0, 1]);

    const started = startHand(base, { rng: createSeededRandom('busted-skip') });
    const busted = getPlayerAtSeat(started, 2);
    const active = getPlayerAtSeat(started, 0);

    expect(busted?.holeCards.length ?? 0).toBe(0);
    expect(busted?.currentBet ?? 0).toBe(0);
    expect(active?.holeCards.length).toBe(2);
    expect(started.table.activeSeatIndex).not.toBe(2);
    expect(started.table.smallBlindSeatIndex).not.toBe(2);
    expect(started.table.bigBlindSeatIndex).not.toBe(2);
  });
});
