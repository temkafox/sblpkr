import { describe, expect, it } from 'vitest';
import type { PlayerGameState, RoomStatePayload, WireSeatView } from '@neonpoker/shared';

import {
  adaptPlayerGameState,
  adaptRoomLobbyState,
  boardRevealFromStreet,
  isActiveHand,
  NO_HAND_SEAT_INDEX,
  occupiedCountToLayoutPreset,
  orderOccupiedSeatsForViewer,
  orderRoomPlayersForViewer,
  resolveSeatNickname,
  shouldShowOppBackcards,
} from './gameStateAdapter';

function emptySeat(index: number): WireSeatView {
  return {
    seatIndex: index,
    playerId: null,
    nickname: null,
    stack: 0,
    currentBet: 0,
    hasFolded: false,
    isAllIn: false,
    isSittingOut: false,
    holeCards: null,
    holeCardCount: null,
  };
}

function occupiedSeat(
  index: number,
  id: string,
  nickname: string | null,
  overrides: Partial<WireSeatView> = {},
): WireSeatView {
  return {
    seatIndex: index,
    playerId: id,
    nickname,
    stack: 100,
    currentBet: 0,
    hasFolded: false,
    isAllIn: false,
    isSittingOut: false,
    holeCards: null,
    holeCardCount: null,
    ...overrides,
  };
}

function baseState(overrides: Partial<PlayerGameState> = {}): PlayerGameState {
  return {
    tableId: 'room-1',
    maxSeats: 9,
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
      occupiedSeat(0, 'p-hero', 'Hero', {
        currentBet: 5,
        holeCards: [
          { r: 'A', s: 's' },
          { r: 'K', s: 'h' },
        ],
        holeCardCount: 2,
      }),
      occupiedSeat(1, 'p-villain', 'Villain', {
        currentBet: 5,
        holeCardCount: 2,
      }),
      ...Array.from({ length: 7 }, (_, i) => emptySeat(i + 2)),
    ],
    ...overrides,
  };
}

const roomRoster: RoomStatePayload = {
  roomId: 'room-1',
  code: 'ABC123',
  maxSeats: 9,
  status: 'waiting',
  players: [
    { playerId: 'p-hero', nickname: 'ljhh', seatIndex: 0 },
    { playerId: 'p-villain', nickname: 'ASD', seatIndex: 1 },
  ],
};

describe('gameStateAdapter', () => {
  it('maps street to board reveal count', () => {
    expect(boardRevealFromStreet(null)).toBe(0);
    expect(boardRevealFromStreet('PRE-FLOP')).toBe(0);
    expect(boardRevealFromStreet('FLOP')).toBe(3);
    expect(boardRevealFromStreet('TURN')).toBe(4);
    expect(boardRevealFromStreet('RIVER')).toBe(5);
    expect(boardRevealFromStreet('SHOWDOWN')).toBe(5);
  });

  it('maps occupied count to layout preset buckets', () => {
    expect(occupiedCountToLayoutPreset(2)).toBe(2);
    expect(occupiedCountToLayoutPreset(3)).toBe(4);
    expect(occupiedCountToLayoutPreset(5)).toBe(6);
    expect(occupiedCountToLayoutPreset(8)).toBe(9);
  });

  it('2-player game state renders only 2 seats in 2-max layout', () => {
    const adapted = adaptPlayerGameState(baseState(), 'Hero', roomRoster);
    expect(adapted.phase).toBe('hand');
    expect(adapted.layout).toHaveLength(2);
    expect(adapted.playersBySeatIndex).toHaveLength(2);
    expect(adapted.gameState.seats).toBe(2);
  });

  it('merges room roster nicknames when wire nickname is null', () => {
    const state = baseState({
      seats: [
        occupiedSeat(0, 'p-hero', null),
        occupiedSeat(1, 'p-villain', null),
      ],
    });
    const adapted = adaptPlayerGameState(state, 'ljhh', roomRoster);
    expect(adapted.playersBySeatIndex[0]?.name).toBe('ljhh');
    expect(adapted.playersBySeatIndex[1]?.name).toBe('ASD');
  });

  it('resolveSeatNickname prefers wire then roster', () => {
    expect(
      resolveSeatNickname(
        { playerId: 'p-hero', nickname: null },
        roomRoster,
      ),
    ).toBe('ljhh');
    expect(
      resolveSeatNickname(
        { playerId: 'p-hero', nickname: 'WireNick' },
        roomRoster,
      ),
    ).toBe('WireNick');
  });

  it('resolveSeatNickname returns null for stale player ids in live room', () => {
    expect(
      resolveSeatNickname(
        { playerId: 'stale-id', nickname: null },
        roomRoster,
      ),
    ).toBeNull();
  });

  it('lobby view shows real nicknames without demo names', () => {
    const lobby = adaptRoomLobbyState(roomRoster, 'ljhh');
    expect(lobby.phase).toBe('waiting');
    expect(lobby.playersBySeatIndex).toHaveLength(2);
    expect(lobby.playersBySeatIndex[0]?.name).toBe('ljhh');
    expect(lobby.playersBySeatIndex[1]?.name).toBe('ASD');
    expect(lobby.boardCards).toHaveLength(0);
    expect(lobby.heroHoleCards).toBeNull();
    expect(lobby.seatStatesBySeatIndex.every((s) => s.status === 'waiting')).toBe(
      true,
    );
    expect(lobby.gameState.dealerSeatIndex).toBe(NO_HAND_SEAT_INDEX);
    expect(
      lobby.playersBySeatIndex.some((p) => p.name === 'NeonRider'),
    ).toBe(false);
  });

  it('isActiveHand is false when handId is null', () => {
    expect(isActiveHand({ ...baseState(), handId: null })).toBe(false);
    expect(isActiveHand(baseState())).toBe(true);
  });

  it('lobby uses stacks from idle table state when provided', () => {
    const idle = baseState({ handId: null, street: null });
    const lobby = adaptRoomLobbyState(roomRoster, 'ljhh', idle);
    expect(lobby.playersBySeatIndex[0]?.stack).toBe(100);
  });

  it('orders room players with viewer first', () => {
    const ordered = orderRoomPlayersForViewer(roomRoster.players, 'ASD');
    expect(ordered.map((p) => p.nickname)).toEqual(['ASD', 'ljhh']);
  });

  it('shows opponent backcards when holeCardCount without cards', () => {
    const adapted = adaptPlayerGameState(baseState(), 'Hero', roomRoster);
    expect(adapted.seatStatesBySeatIndex[1]?.showOppBackcards).toBe(true);
  });

  it('does not expose opponent hole card faces', () => {
    const state = baseState();
    expect(shouldShowOppBackcards(state.seats[1]!, 1)).toBe(true);
    expect(state.seats[1]!.holeCards).toBeNull();
  });

  it('places viewer at layout seat 0', () => {
    const adapted = adaptPlayerGameState(baseState(), 'Hero', roomRoster);
    expect(adapted.playersBySeatIndex[0]?.name).toBe('Hero');
    expect(adapted.layout[0]?.hero).toBe(true);
  });

  it('orders occupied seats with viewer first', () => {
    const seats = baseState().seats;
    const ordered = orderOccupiedSeatsForViewer(seats, 0);
    expect(ordered).toHaveLength(2);
    expect(ordered[0]?.nickname).toBe('Hero');
  });

  it('disables action bar when viewer is not active', () => {
    const adapted = adaptPlayerGameState(
      baseState({ activeSeatIndex: 1 }),
      'Hero',
      roomRoster,
    );
    expect(adapted.actionBar.actionsEnabled).toBe(false);
  });

  it('active hand view uses hand phase', () => {
    const adapted = adaptPlayerGameState(baseState(), 'Hero', roomRoster);
    expect(adapted.phase).toBe('hand');
    expect(adapted.boardCards.length).toBeGreaterThanOrEqual(5);
  });

  it('enables action bar when viewer is active and has availableActions', () => {
    const adapted = adaptPlayerGameState(
      baseState({
        activeSeatIndex: 0,
        availableActions: {
          canFold: true,
          canCheck: true,
          canCall: false,
          callAmount: 0,
          canRaise: true,
          minRaise: 4,
          maxRaise: 100,
          canAllIn: true,
        },
      }),
      'Hero',
      roomRoster,
    );
    expect(adapted.actionBar.actionsEnabled).toBe(true);
  });
});
