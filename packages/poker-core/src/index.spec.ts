import { describe, expect, it } from 'vitest';

import {
  CoreGameState,
  createDeck,
  createInitialGameState,
  createSeededRandom,
  shuffleDeck,
} from './index';

describe('@neonpoker/poker-core barrel', () => {
  it('exports deck helpers', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('exports composable CoreGameState factories', () => {
    const game = createInitialGameState({
      table: {
        tableId: 'tbl',
        maxSeats: 4,
        smallBlind: 5,
        bigBlind: 10,
      },
    });
    const typed: CoreGameState = game;
    expect(typed.hand).toBeNull();
    expect(typed.table.maxSeats).toBe(4);
  });

  it('does not mutate deck via shuffle helper', () => {
    const ordered = createDeck();
    shuffleDeck(ordered, createSeededRandom(12345));
    expect(ordered).toEqual(createDeck());
  });
});
