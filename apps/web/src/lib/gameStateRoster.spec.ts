import { describe, expect, it } from 'vitest';
import type { PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import {
  gameStateMatchesRoomRoster,
  shouldAcceptGameStatePayload,
  shouldClearGameStateForRoom,
} from './gameStateRoster';
import { mockRoomState } from '../test/roomFixtures';

const room: RoomStatePayload = mockRoomState({
  roomId: 'room-1',
  players: [
    { playerId: 'a', nickname: 'Alice', seatIndex: 0, connectionStatus: 'connected' },
  ],
});

const activeHand: PlayerGameState = {
  tableId: 'room-1',
  maxSeats: 9,
  viewerSeatIndex: 0,
  street: 'PRE-FLOP',
  boardCards: [],
  pot: { total: 3, sidePots: [] },
  dealerSeatIndex: 0,
  smallBlindSeatIndex: 0,
  bigBlindSeatIndex: 1,
  activeSeatIndex: 0,
  handId: 'hand-1',
  handComplete: false,
  showdownReady: false,
  seats: [
    {
      seatIndex: 0,
      playerId: 'a',
      nickname: 'Alice',
      stack: 200,
      currentBet: 1,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: null,
      holeCardCount: 2,
    },
    {
      seatIndex: 1,
      playerId: 'stale-b',
      nickname: 'Bob',
      stack: 200,
      currentBet: 2,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: null,
      holeCardCount: 2,
    },
  ],
};

describe('gameStateRoster', () => {
  it('clears game state when room drops below two players', () => {
    expect(shouldClearGameStateForRoom(room, activeHand)).toBe(true);
  });

  it('clears when active hand has stale player ids', () => {
    const duo: RoomStatePayload = {
      ...room,
      players: [
        { playerId: 'a', nickname: 'Alice', seatIndex: 0, connectionStatus: 'connected' },
        { playerId: 'b', nickname: 'Bob', seatIndex: 1, connectionStatus: 'connected' },
      ],
    };
    expect(gameStateMatchesRoomRoster(activeHand, duo)).toBe(false);
    expect(shouldClearGameStateForRoom(duo, activeHand)).toBe(true);
  });

  it('rejects stale active-hand payloads', () => {
    expect(shouldAcceptGameStatePayload(activeHand, room)).toBe(false);
  });
});
