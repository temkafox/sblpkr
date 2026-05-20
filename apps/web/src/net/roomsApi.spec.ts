import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoom, getRoom } from './roomsApi';

describe('roomsApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createRoom POSTs /rooms and returns JSON', async () => {
    const body = {
      roomId: '11111111-1111-4111-8111-111111111111',
      code: 'ABC123',
      maxSeats: 9,
      status: 'waiting' as const,
      seatedCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => body,
    } as Response);

    const result = await createRoom(9);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/rooms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ maxSeats: 9 }),
      }),
    );
    expect(result).toEqual(body);
  });

  it('getRoom GETs /rooms/:id and returns JSON', async () => {
    const body = {
      roomId: '11111111-1111-4111-8111-111111111111',
      code: 'ABC123',
      maxSeats: 9,
      status: 'waiting' as const,
      seatedCount: 1,
      capacityAvailable: true,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);

    const result = await getRoom('ABC123');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/rooms/ABC123',
      expect.any(Object),
    );
    expect(result).toEqual(body);
  });

  it('getRoom throws HttpError on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }),
    } as Response);

    await expect(getRoom('NOPE00')).rejects.toMatchObject({
      status: 404,
      code: 'ROOM_NOT_FOUND',
    });
  });
});
