import { describe, expect, it } from 'vitest';

import { mockRoomState } from '../test/roomFixtures';
import { useRoomStore } from './roomStore';

describe('roomStore', () => {
  it('setRoomState clears lastError', () => {
    useRoomStore.setState({
      roomState: null,
      lastError: { code: 'ROOM_FULL', message: 'full' },
    });

    useRoomStore.getState().setRoomState(mockRoomState());

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
