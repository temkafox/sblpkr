import {
  DEFAULT_ROOM_SETTINGS,
  type CreateRoomResponse,
  type GetRoomResponse,
  type RoomStatePayload,
} from '@neonpoker/shared';

const DEFAULT_ROOM_ID = '11111111-1111-4111-8111-111111111111';

export function mockRoomState(
  overrides: Partial<RoomStatePayload> = {},
): RoomStatePayload {
  return {
    roomId: DEFAULT_ROOM_ID,
    code: 'ABC123',
    maxSeats: 9,
    status: 'waiting',
    players: [],
    settings: DEFAULT_ROOM_SETTINGS,
    ...overrides,
  };
}

export function mockGetRoomResponse(
  overrides: Partial<GetRoomResponse> = {},
): GetRoomResponse {
  return {
    roomId: DEFAULT_ROOM_ID,
    code: 'ABC123',
    maxSeats: 9,
    status: 'waiting',
    seatedCount: 0,
    capacityAvailable: true,
    settings: DEFAULT_ROOM_SETTINGS,
    ...overrides,
  };
}

export function mockCreateRoomResponse(
  overrides: Partial<CreateRoomResponse> = {},
): CreateRoomResponse {
  return {
    roomId: DEFAULT_ROOM_ID,
    code: 'ABC123',
    maxSeats: 9,
    status: 'waiting',
    seatedCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: DEFAULT_ROOM_SETTINGS,
    ...overrides,
  };
}
