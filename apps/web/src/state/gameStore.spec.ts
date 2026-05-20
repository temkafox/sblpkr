import { describe, expect, it } from 'vitest';

import { useGameStore } from './gameStore';

describe('gameStore', () => {
  it('setGameState clears loading and error', () => {
    useGameStore.setState({
      gameState: null,
      isGameLoading: true,
      gameError: 'fail',
      handResult: null,
    });

    useGameStore.getState().setGameState({
      tableId: 't1',
      maxSeats: 2,
      street: null,
      boardCards: [],
      pot: { total: 0, sidePots: [] },
      dealerSeatIndex: null,
      smallBlindSeatIndex: null,
      bigBlindSeatIndex: null,
      activeSeatIndex: null,
      seats: [],
      handId: null,
      handComplete: false,
      showdownReady: false,
    });

    const s = useGameStore.getState();
    expect(s.isGameLoading).toBe(false);
    expect(s.gameError).toBeNull();
    expect(s.gameState?.tableId).toBe('t1');
  });

  it('clearGameState resets all fields', () => {
    useGameStore.getState().setHandResult({ handId: 'h1', winnerSeatIndexes: [0] });
    useGameStore.getState().clearGameState();
    const s = useGameStore.getState();
    expect(s.gameState).toBeNull();
    expect(s.handResult).toBeNull();
  });
});
