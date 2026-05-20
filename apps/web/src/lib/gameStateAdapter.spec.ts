import { describe, expect, it } from 'vitest';
import type { PlayerGameState } from '@neonpoker/shared';

import {
  adaptPlayerGameState,
  boardRevealFromStreet,
  findViewerSeatIndex,
  shouldShowOppBackcards,
} from './gameStateAdapter';

function baseState(overrides: Partial<PlayerGameState> = {}): PlayerGameState {
  return {
    tableId: 'room-1',
    maxSeats: 2,
    street: 'FLOP',
    boardCards: [
      { r: '10', s: 'h' },
      { r: 'J', s: 'c' },
      { r: 'Q', s: 'd' },
    ],
    pot: { total: 15, sidePots: [] },
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 1,
    activeSeatIndex: 1,
    handId: 'hand-1',
    handComplete: false,
    showdownReady: false,
    seats: [
      {
        seatIndex: 0,
        playerId: 'p-hero',
        nickname: 'Hero',
        stack: 100,
        currentBet: 5,
        hasFolded: false,
        isAllIn: false,
        isSittingOut: false,
        holeCards: [
          { r: 'A', s: 's' },
          { r: 'K', s: 'h' },
        ],
        holeCardCount: 2,
      },
      {
        seatIndex: 1,
        playerId: 'p-villain',
        nickname: 'Villain',
        stack: 95,
        currentBet: 5,
        hasFolded: false,
        isAllIn: false,
        isSittingOut: false,
        holeCards: null,
        holeCardCount: 2,
      },
    ],
    ...overrides,
  };
}

describe('gameStateAdapter', () => {
  it('maps street to board reveal count', () => {
    expect(boardRevealFromStreet(null)).toBe(0);
    expect(boardRevealFromStreet('PRE-FLOP')).toBe(0);
    expect(boardRevealFromStreet('FLOP')).toBe(3);
    expect(boardRevealFromStreet('TURN')).toBe(4);
    expect(boardRevealFromStreet('RIVER')).toBe(5);
    expect(boardRevealFromStreet('SHOWDOWN')).toBe(5);
  });

  it('finds viewer seat by visible hole cards', () => {
    const state = baseState();
    expect(findViewerSeatIndex(state, 'Villain')).toBe(0);
  });

  it('shows opponent backcards when holeCardCount without cards', () => {
    const state = baseState();
    const adapted = adaptPlayerGameState(state, 'Hero');
    expect(adapted.heroHoleCards).toEqual([
      { r: 'A', s: 's' },
      { r: 'K', s: 'h' },
    ]);
    expect(adapted.seatStatesBySeatIndex[1]?.showOppBackcards).toBe(true);
    expect(adapted.seatStatesBySeatIndex[0]?.showOppBackcards).toBe(false);
  });

  it('does not expose opponent hole card faces', () => {
    const state = baseState();
    expect(shouldShowOppBackcards(state.seats[1]!, 1)).toBe(true);
    expect(state.seats[1]!.holeCards).toBeNull();
    const adapted = adaptPlayerGameState(state, 'Hero');
    expect(adapted.playersBySeatIndex[1]?.name).toBe('Villain');
  });

  it('rotates viewer to layout seat 0', () => {
    const state = baseState();
    const adapted = adaptPlayerGameState(state, 'Hero');
    expect(adapted.playersBySeatIndex[0]?.name).toBe('Hero');
    expect(adapted.gameState.activeSeatIndex).toBe(1);
  });
});
