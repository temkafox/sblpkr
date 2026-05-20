import { describe, expect, it } from 'vitest';

import {
  assertUniqueDeck,
  createDeck,
  createInitialGameState,
  createInitialPlayerState,
  createInitialTableState,
  createSeededRandom,
  createShuffledDeck,
  shuffleDeck,
} from './index';

describe('createDeck', () => {
  it('returns 52 cards', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('has unique rank/suit pairs', () => {
    expect(assertUniqueDeck(createDeck())).toBe(true);
  });
});

describe('shuffleDeck', () => {
  it('does not mutate the original deck order', () => {
    const deck = createDeck();
    const snapshot = [...deck];
    const rng = createSeededRandom('shuffle-immutable');
    shuffleDeck(deck, rng);
    expect([...deck]).toEqual(snapshot);
  });

  it('is deterministic for the same seed', () => {
    const rngA = createSeededRandom('phase3-deterministic');
    const rngB = createSeededRandom('phase3-deterministic');
    const a = shuffleDeck(createDeck(), rngA);
    const b = shuffleDeck(createDeck(), rngB);
    expect(a).toEqual(b);
  });

  it('permutes order for a typical seed vs ordered deck', () => {
    const ordered = createDeck();
    const shuffled = createShuffledDeck(createSeededRandom('phase3-not-identity'));
    expect(shuffled).not.toEqual(ordered);
    expect(assertUniqueDeck(shuffled)).toBe(true);
  });
});

describe('factories', () => {
  it('createInitialTableState builds empty seats', () => {
    const table = createInitialTableState({
      tableId: 't1',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
    });
    expect(table.maxSeats).toBe(6);
    expect(table.seats).toHaveLength(6);
    expect(table.seats.every((s) => s.playerId === null)).toBe(true);
  });

  it('createInitialPlayerState zeros bets and commitments', () => {
    const p = createInitialPlayerState({
      playerId: 'p1',
      seatIndex: 2,
      startingChips: 500,
    });
    expect(p.chips).toBe(500);
    expect(p.holeCards).toHaveLength(0);
    expect(p.currentBet).toBe(0);
    expect(p.totalCommitted).toBe(0);
    expect(p.hasFolded).toBe(false);
    expect(p.isAllIn).toBe(false);
    expect(p.isSittingOut).toBe(false);
  });

  it('createInitialGameState wires seated players', () => {
    const game = createInitialGameState({
      table: {
        tableId: 't1',
        maxSeats: 9,
        smallBlind: 1,
        bigBlind: 2,
      },
      players: [
        { playerId: 'a', seatIndex: 0, startingChips: 100 },
        { playerId: 'b', seatIndex: 3, startingChips: 200 },
      ],
    });

    expect(game.hand).toBeNull();
    expect(Object.keys(game.playersById)).toEqual(['a', 'b']);
    expect(game.table.seats[0]?.playerId).toBe('a');
    expect(game.table.seats[3]?.playerId).toBe('b');
    expect(game.playersById.a?.seatIndex).toBe(0);
    expect(game.playersById.b?.chips).toBe(200);
  });

  it('createInitialGameState rejects duplicate seats', () => {
    expect(() =>
      createInitialGameState({
        table: {
          tableId: 't1',
          maxSeats: 6,
          smallBlind: 1,
          bigBlind: 2,
        },
        players: [
          { playerId: 'a', seatIndex: 1, startingChips: 100 },
          { playerId: 'b', seatIndex: 1, startingChips: 100 },
        ],
      }),
    ).toThrow(/duplicate seat assignment/);
  });
});
