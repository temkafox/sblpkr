import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ROOM_SETTINGS,
  mergeRoomSettings,
  RoomSettingsSchema,
} from './room-settings.dto';

describe('RoomSettings', () => {
  it('defaults validate', () => {
    expect(RoomSettingsSchema.parse(DEFAULT_ROOM_SETTINGS)).toEqual(
      DEFAULT_ROOM_SETTINGS,
    );
  });

  it('mergeRoomSettings applies defaults', () => {
    const merged = mergeRoomSettings({});
    expect(merged.maxSeats).toBe(9);
    expect(merged.startingStack).toBe(200);
    expect(merged.bigBlind).toBe(2);
  });

  it('bigBlind defaults to 2× smallBlind when omitted', () => {
    const merged = mergeRoomSettings({ smallBlind: 5 });
    expect(merged.smallBlind).toBe(5);
    expect(merged.bigBlind).toBe(10);
  });

  it('empty roomName becomes Neon Table', () => {
    const merged = mergeRoomSettings({ roomName: '   ' });
    expect(merged.roomName).toBe('Neon Table');
  });

  it('rejects startingStack below 20× big blind', () => {
    expect(() =>
      mergeRoomSettings({ startingStack: 10, bigBlind: 2, smallBlind: 1 }),
    ).toThrow();
  });

  it('rejects invalid action timeout', () => {
    expect(() => mergeRoomSettings({ actionTimeoutSeconds: 3 })).toThrow();
    expect(() => mergeRoomSettings({ actionTimeoutSeconds: 200 })).toThrow();
  });

  it('accepts maxRebuysPerPlayer null and 0', () => {
    expect(mergeRoomSettings({ maxRebuysPerPlayer: null }).maxRebuysPerPlayer).toBe(
      null,
    );
    expect(mergeRoomSettings({ maxRebuysPerPlayer: 0 }).maxRebuysPerPlayer).toBe(0);
  });
});
