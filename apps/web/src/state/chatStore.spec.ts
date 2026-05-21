import { describe, expect, it } from 'vitest';

import { useChatStore } from './chatStore';

describe('chatStore', () => {
  it('replaces messages on snapshot update without duplicates', () => {
    const first = {
      id: 'm1',
      roomId: 'r1',
      playerId: 'p1',
      nickname: 'A',
      text: 'hi',
      sequence: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    useChatStore.getState().setChatMessages([first]);
    useChatStore.getState().setChatMessages([
      first,
      {
        id: 'm2',
        roomId: 'r1',
        playerId: 'p2',
        nickname: 'B',
        text: 'yo',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
      },
    ]);
    useChatStore.getState().setChatMessages([
      first,
      {
        id: 'm2',
        roomId: 'r1',
        playerId: 'p2',
        nickname: 'B',
        text: 'yo',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
      },
    ]);

    const messages = useChatStore.getState().chatMessages;
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('clears chat messages', () => {
    useChatStore.getState().setChatMessages([
      {
        id: 'm1',
        roomId: 'r1',
        playerId: 'p1',
        nickname: 'A',
        text: 'hi',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    useChatStore.getState().clearChatMessages();
    expect(useChatStore.getState().chatMessages).toEqual([]);
  });
});
