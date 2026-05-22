import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as roomsApi from './roomsApi';
import * as socket from './socket';
import { mockGetRoomResponse, mockRoomState } from '../test/roomFixtures';
import { useRoomStore } from '../state/roomStore';
import { establishRoomSession, reconnectRoomSession } from './roomSession';

vi.mock('./roomsApi', () => ({
  getRoom: vi.fn(),
}));

vi.mock('./socket', () => ({
  connectSocket: vi.fn().mockResolvedValue({}),
  joinRoom: vi.fn().mockResolvedValue({ roomId: 'room-1' }),
  registerNickname: vi.fn(),
  requestGameState: vi.fn(),
  requestHandHistory: vi.fn(),
  requestChatMessages: vi.fn(),
}));

vi.mock('../lib/clientSession', () => ({
  getOrCreateClientSessionId: () => 'client-session-1',
}));

const roomResponse = mockGetRoomResponse({ seatedCount: 1 });

describe('roomSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(roomsApi.getRoom).mockResolvedValue(roomResponse);
  });

  it('establishRoomSession requests chat after join', async () => {
    vi.mocked(socket.joinRoom).mockImplementation(async (roomId) => {
      const state = mockRoomState({
        roomId,
        players: [
          {
            playerId: 'p1',
            nickname: 'Alice',
            seatIndex: 0,
            connectionStatus: 'connected',
          },
        ],
      });
      useRoomStore.getState().setRoomState(state);
      return state;
    });

    await establishRoomSession('Alice', roomResponse.roomId);

    expect(useRoomStore.getState().roomState?.players).toHaveLength(1);
    expect(socket.requestChatMessages).toHaveBeenCalledWith(roomResponse.roomId);
  });

  it('reconnectRoomSession requests chat after rejoin', async () => {
    await reconnectRoomSession('Alice', roomResponse.roomId);
    expect(socket.requestChatMessages).toHaveBeenCalledWith(roomResponse.roomId);
  });
});
