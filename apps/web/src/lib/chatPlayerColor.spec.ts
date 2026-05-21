import { describe, expect, it } from 'vitest';

import {
  CHAT_PLAYER_TONES,
  getChatPlayerColorKey,
  getChatPlayerTone,
} from './chatPlayerColor';
import { chatRowsFromMessages } from './chatAdapter';

function message(
  overrides: Partial<{
    id: string;
    playerId: string;
    nickname: string;
    text: string;
    sequence: number;
  }> = {},
) {
  return {
    id: overrides.id ?? 'm1',
    roomId: 'r1',
    playerId: overrides.playerId ?? 'player-a',
    nickname: overrides.nickname ?? 'Alice',
    text: overrides.text ?? 'hi',
    sequence: overrides.sequence ?? 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('chat player color', () => {
  it('uses playerId for color key when present', () => {
    expect(
      getChatPlayerColorKey({ playerId: 'p-1', nickname: 'Neo' }),
    ).toBe('id:p-1');
  });

  it('falls back to normalized nickname when playerId is empty', () => {
    expect(
      getChatPlayerColorKey({ playerId: '  ', nickname: ' Neo ' }),
    ).toBe('nick:neo');
  });

  it('assigns the same tone for the same player across messages', () => {
    const tone = getChatPlayerTone(getChatPlayerColorKey(message()));
    expect(getChatPlayerTone(getChatPlayerColorKey(message({ sequence: 99 })))).toBe(
      tone,
    );
    const rows = chatRowsFromMessages([
      message({ id: 'm1', sequence: 1, text: 'one' }),
      message({ id: 'm2', sequence: 2, text: 'two' }),
      message({ id: 'm3', sequence: 50, text: 'three' }),
    ]);
    expect(new Set(rows.map((r) => r.cls)).size).toBe(1);
    expect(CHAT_PLAYER_TONES).toContain(rows[0]!.cls);
  });

  it('assigns different tones for two typical playerIds', () => {
    const toneA = getChatPlayerTone(
      getChatPlayerColorKey({
        playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
        nickname: 'd32f',
      }),
    );
    const toneB = getChatPlayerTone(
      getChatPlayerColorKey({
        playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
        nickname: 'neo99',
      }),
    );
    expect(toneA).not.toBe(toneB);
  });

  it('maps nickname fallback deterministically', () => {
    const key = getChatPlayerColorKey({ playerId: '', nickname: 'StableNick' });
    expect(getChatPlayerTone(key)).toBe(getChatPlayerTone(key));
  });
});
