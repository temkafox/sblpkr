import { describe, expect, it } from 'vitest';

import {
  createInitialGameState,
  getActiveSeatIndexes,
  getBigBlindSeatIndex,
  getFirstToActPreflop,
  getNextActiveSeatIndex,
  getNextOccupiedSeatIndex,
  getOccupiedSeatIndexes,
  getSmallBlindSeatIndex,
} from '../index';
import type { CoreGameState } from '../domain/game-state';
import type { TableState } from '../domain/table-state';

function withTablePatch(
  state: CoreGameState,
  patch: Partial<TableState>,
): CoreGameState {
  return Object.freeze({
    ...state,
    table: Object.freeze({ ...state.table, ...patch }),
  });
}

describe('seat-utils', () => {
  const ring6 = (): CoreGameState =>
    createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'p0', seatIndex: 1, startingChips: 500 },
        { playerId: 'p1', seatIndex: 3, startingChips: 500 },
        { playerId: 'p2', seatIndex: 5, startingChips: 500 },
      ],
    });

  it('getOccupiedSeatIndexes lists seated players', () => {
    expect(getOccupiedSeatIndexes(ring6())).toEqual([1, 3, 5]);
  });

  it('getNextOccupiedSeatIndex wraps clockwise', () => {
    const g = ring6();
    expect(getNextOccupiedSeatIndex(g, 1)).toBe(3);
    expect(getNextOccupiedSeatIndex(g, 5)).toBe(1);
  });

  it('getNextActiveSeatIndex skips sitting-out players', () => {
    const base = ring6();
    const g = Object.freeze({
      ...base,
      playersById: Object.freeze({
        ...base.playersById,
        p1: Object.freeze({
          ...base.playersById.p1!,
          isSittingOut: true,
        }),
      }),
    });

    expect(getActiveSeatIndexes(g)).toEqual([1, 5]);
    expect(getNextActiveSeatIndex(g, 1)).toBe(5);
    expect(getNextActiveSeatIndex(g, 5)).toBe(1);
  });

  it('heads-up: dealer is SB and BB is the other seat', () => {
    const hu = createInitialGameState({
      table: {
        tableId: 'hu',
        maxSeats: 4,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'a', seatIndex: 0, startingChips: 100 },
        { playerId: 'b', seatIndex: 3, startingChips: 100 },
      ],
    });

    const dealerAtThree = withTablePatch(hu, { dealerSeatIndex: 3 });

    expect(getSmallBlindSeatIndex(dealerAtThree, 3)).toBe(3);
    expect(getBigBlindSeatIndex(dealerAtThree, 3)).toBe(0);
    expect(getFirstToActPreflop(dealerAtThree)).toBe(3);
  });

  it('3+ players: SB left of dealer, BB left of SB, UTG left of BB', () => {
    const g = withTablePatch(ring6(), { dealerSeatIndex: 1 });

    expect(getSmallBlindSeatIndex(g, 1)).toBe(3);
    expect(getBigBlindSeatIndex(g, 3)).toBe(5);
    expect(getFirstToActPreflop(g)).toBe(1);
  });

  it('9-max blind positions follow clockwise active seats', () => {
    const g = createInitialGameState({
      table: {
        tableId: 'nine',
        maxSeats: 9,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'a', seatIndex: 2, startingChips: 400 },
        { playerId: 'b', seatIndex: 4, startingChips: 400 },
        { playerId: 'c', seatIndex: 7, startingChips: 400 },
      ],
    });

    const s = withTablePatch(g, { dealerSeatIndex: 2 });

    expect(getSmallBlindSeatIndex(s, 2)).toBe(4);
    expect(getBigBlindSeatIndex(s, 4)).toBe(7);
    expect(getFirstToActPreflop(s)).toBe(2);
  });
});
