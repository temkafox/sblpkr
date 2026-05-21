import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as roomsApi from './roomsApi';
import * as socket from './socket';
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

const roomResponse = {
  roomId: '11111111-1111-4111-8111-111111111111',
  code: 'ABC123',
  maxSeats: 9 as const,
  status: 'waiting' as const,
  seatedCount: 1,
  capacityAvailable: true,
};

describe('roomSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(roomsApi.getRoom).mockResolvedValue(roomResponse);
  });

  it('establishRoomSession requests chat after join', async () => {
    await establishRoomSession('Alice', roomResponse.roomId);
    expect(socket.requestChatMessages).toHaveBeenCalledWith(roomResponse.roomId);
  });

  it('reconnectRoomSession requests chat after rejoin', async () => {
    await reconnectRoomSession('Alice', roomResponse.roomId);
    expect(socket.requestChatMessages).toHaveBeenCalledWith(roomResponse.roomId);
  });
});
