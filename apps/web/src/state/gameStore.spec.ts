import { beforeEach, describe, expect, it } from 'vitest';
import type { HandHistoryPayload } from '@neonpoker/shared';

import { useGameStore } from './gameStore';

describe('gameStore hand history', () => {
  beforeEach(() => {
    useGameStore.getState().clearGameState();
  });

  it('replaces snapshot by revision without duplicating rows', () => {
    const payload: HandHistoryPayload = {
      roomId: 'room-1',
      handId: 'h1',
      handNumber: 1,
      revision: 2,
      streets: [
        {
          street: 'PRE-FLOP',
          entries: [
            {
              seq: 0,
              street: 'PRE-FLOP',
              text: 'Alpha calls $2',
              nickname: 'Alpha',
              actionKind: 'call',
              amount: 2,
            },
          ],
        },
      ],
    };

    useGameStore.getState().setHandHistory(payload);
    const rowsAfterFirst = useGameStore.getState().handHistory[0]?.rows.length;

    useGameStore.getState().setHandHistory(payload);

    expect(useGameStore.getState().handHistoryRevision).toBe(2);
    expect(useGameStore.getState().handHistory[0]?.rows.length).toBe(rowsAfterFirst);
  });
});
