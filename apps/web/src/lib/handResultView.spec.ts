import { describe, expect, it } from 'vitest';
import type { HandResultPayload, RoomStatePayload } from '@neonpoker/shared';

import {
  buildHandResultWinnerLines,
  handResultHeadline,
} from './handResultView';
import { mockRoomState } from '../test/roomFixtures';

const room: RoomStatePayload = mockRoomState({
  roomId: 'room-1',
  code: 'ABC',
  players: [
    { playerId: 'a', nickname: 'Alice', seatIndex: 0, connectionStatus: 'connected' },
    { playerId: 'b', nickname: 'Bob', seatIndex: 1, connectionStatus: 'connected' },
  ],
});

describe('handResultView', () => {
  it('builds winner lines with nicknames and integer awards', () => {
    const result: HandResultPayload = {
      handId: 'h1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 15 },
      totalAwarded: 15,
      isFoldWin: true,
    };
    const lines = buildHandResultWinnerLines(result, room, null);
    expect(lines).toEqual([
      {
        seatIndex: 0,
        nickname: 'Alice',
        amount: 15,
        handLabel: null,
      },
    ]);
  });

  it('renders split pot winners', () => {
    const result: HandResultPayload = {
      handId: 'h2',
      winnerSeatIndexes: [0, 1],
      awardedAmountsBySeatIndex: { '0': 10, '1': 10 },
      totalAwarded: 20,
      isFoldWin: false,
      winningHandLabel: 'Two Pair',
    };
    const lines = buildHandResultWinnerLines(result, room, null);
    expect(lines).toHaveLength(2);
    expect(handResultHeadline(result)).toContain('split pot');
  });

  it('does not include deck or hole cards in payload shape', () => {
    const result: HandResultPayload = {
      handId: 'h3',
      winnerSeatIndexes: [1],
      awardedAmountsBySeatIndex: { '1': 20 },
      totalAwarded: 20,
    };
    expect(result).not.toHaveProperty('deck');
    expect(result).not.toHaveProperty('holeCards');
  });
});
