import { describe, expect, it } from 'vitest';
import type { HandHistoryPayload } from '@neonpoker/shared';

import { handHistoryStreetsFromPayload } from './handHistoryAdapter';

describe('handHistoryAdapter', () => {
  it('returns empty streets for null payload', () => {
    expect(handHistoryStreetsFromPayload(null)).toEqual([]);
  });

  it('maps entries to name/act rows grouped by street', () => {
    const payload: HandHistoryPayload = {
      roomId: 'room-1',
      handId: 'h1',
      handNumber: 1,
      streets: [
        {
          street: 'PRE-FLOP',
          entries: [
            {
              seq: 0,
              street: 'PRE-FLOP',
              text: 'Alpha calls $2',
              nickname: 'Alpha',
              nameColor: 'n-c',
              actionKind: 'call',
              amount: 2,
            },
            {
              seq: 1,
              street: 'PRE-FLOP',
              text: 'Beta raises to $8',
              nickname: 'Beta',
              nameColor: 'n-m',
              actionKind: 'raise',
              amount: 8,
            },
          ],
        },
      ],
    };

    const streets = handHistoryStreetsFromPayload(payload);
    expect(streets).toHaveLength(1);
    expect(streets[0]!.rows[0]).toEqual({
      name: 'Alpha',
      cls: 'n-c',
      act: 'calls $2',
    });
    expect(streets[0]!.rows[1]?.act).toBe('raises to $8');
    expect(streets[0]!.rows.some((r) => r.name === 'StackMaster')).toBe(false);
  });
});
