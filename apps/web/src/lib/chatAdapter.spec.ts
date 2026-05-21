import { describe, expect, it } from 'vitest';

import { getChatPlayerTone, getChatPlayerColorKey } from './chatPlayerColor';
import { chatRowsFromMessages } from './chatAdapter';

describe('chatRowsFromMessages', () => {
  it('maps nickname, text, and stable player tone', () => {
    const player = {
      id: 'm1',
      roomId: 'r1',
      playerId: 'p1',
      nickname: 'Neo',
      text: 'gl hf',
      sequence: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const rows = chatRowsFromMessages([player]);
    expect(rows[0]).toEqual({
      id: 'm1',
      who: 'Neo',
      cls: getChatPlayerTone(getChatPlayerColorKey(player)),
      msg: 'gl hf',
    });
  });
});
