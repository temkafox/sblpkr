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
    expect(s.isSubmittingAction).toBe(false);
    expect(s.gameState?.tableId).toBe('t1');
  });

  it('setGameError clears submitting state', () => {
    useGameStore.getState().setSubmittingAction(true);
    useGameStore.getState().setGameError('Not your turn');
    expect(useGameStore.getState().isSubmittingAction).toBe(false);
    expect(useGameStore.getState().gameError).toBe('Not your turn');
  });

  it('setGameState clears handResult when a new hand starts', () => {
    useGameStore.getState().setHandResult({
      handId: 'old-hand',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 10 },
      totalAwarded: 10,
    });

    useGameStore.getState().setGameState({
      tableId: 't1',
      maxSeats: 2,
      street: 'PRE-FLOP',
      boardCards: [],
      pot: { total: 3, sidePots: [] },
      dealerSeatIndex: 0,
      smallBlindSeatIndex: 0,
      bigBlindSeatIndex: 1,
      activeSeatIndex: 0,
      seats: [],
      handId: 'new-hand',
      handComplete: false,
      showdownReady: false,
    });

    expect(useGameStore.getState().handResult).toBeNull();
  });

  it('clearHandResult resets only hand result', () => {
    useGameStore.getState().setHandResult({
      handId: 'h1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 10 },
      totalAwarded: 10,
    });
    useGameStore.getState().clearHandResult();
    expect(useGameStore.getState().handResult).toBeNull();
  });

  it('clearGameState resets all fields', () => {
    useGameStore.getState().setHandResult({
      handId: 'h1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 10 },
      totalAwarded: 10,
    });
    useGameStore.getState().clearGameState();
    const s = useGameStore.getState();
    expect(s.gameState).toBeNull();
    expect(s.handResult).toBeNull();
  });
});
