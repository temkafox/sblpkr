import { describe, expect, it } from 'vitest';

import { useRoomStore } from './roomStore';

describe('roomStore', () => {
  it('setRoomState clears lastError', () => {
    useRoomStore.setState({
      roomState: null,
      lastError: { code: 'ROOM_FULL', message: 'full' },
    });

    useRoomStore.getState().setRoomState({
      roomId: '11111111-1111-4111-8111-111111111111',
      code: 'ABC123',
      maxSeats: 9,
      players: [],
      status: 'waiting',
    });

    expect(useRoomStore.getState().lastError).toBeNull();
    expect(useRoomStore.getState().roomState?.code).toBe('ABC123');
  });

  it('clearRoomState resets snapshot and error', () => {
    useRoomStore.getState().setError({ code: 'INVALID_PAYLOAD' });
    useRoomStore.getState().clearRoomState();

    expect(useRoomStore.getState().roomState).toBeNull();
    expect(useRoomStore.getState().lastError).toBeNull();
  });
});
