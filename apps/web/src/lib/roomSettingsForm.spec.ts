import { describe, expect, it } from 'vitest';

import {
  CREATE_ROOM_SETTINGS_DEFAULTS,
  formToPartial,
  gameInfoFromRoomSettings,
  resolveRoomSettings,
  validateCreateRoomSettingsForm,
} from './roomSettingsForm';
import { DEFAULT_ROOM_SETTINGS, mergeRoomSettings } from '@neonpoker/shared';

describe('roomSettingsForm', () => {
  it('defaults match shared DEFAULT_ROOM_SETTINGS', () => {
    const partial = formToPartial(CREATE_ROOM_SETTINGS_DEFAULTS);
    expect(mergeRoomSettings(partial)).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it('validateCreateRoomSettingsForm rejects low starting stack', () => {
    const errors = validateCreateRoomSettingsForm({
      ...CREATE_ROOM_SETTINGS_DEFAULTS,
      startingStack: '5',
      smallBlind: '1',
      bigBlind: '2',
    });
    expect(errors.startingStack ?? errors._form).toBeTruthy();
  });

  it('resolveRoomSettings falls back when settings missing', () => {
    expect(resolveRoomSettings({ maxSeats: 6 })).toEqual({
      ...DEFAULT_ROOM_SETTINGS,
      maxSeats: 6,
    });
  });

  it('gameInfoFromRoomSettings formats blinds and rebuy line', () => {
    const info = gameInfoFromRoomSettings(
      mergeRoomSettings({ smallBlind: 5, bigBlind: 10, rebuyAmount: 500, maxRebuysPerPlayer: 1 }),
      2,
    );
    expect(info.stakes).toBe('$5 / $10');
    expect(info.rebuyLine).toContain('500');
    expect(info.rebuyLine).toContain('1');
    expect(info.playerCount).toBe(2);
  });

  it('gameInfoFromRoomSettings tolerates undefined settings', () => {
    const info = gameInfoFromRoomSettings(undefined, 0);
    expect(info.gameType).toBe('Neon Table');
    expect(info.stakes).toBe('$1 / $2');
  });
});
