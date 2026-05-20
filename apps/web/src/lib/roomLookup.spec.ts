import { describe, expect, it } from 'vitest';

import { isValidRoomLookup, resolveRoomLookupParam } from './roomLookup';

describe('roomLookup', () => {
  it('accepts UUID room ids', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(isValidRoomLookup(id)).toBe(true);
    expect(resolveRoomLookupParam(id)).toBe(id);
  });

  it('normalizes 6-character codes', () => {
    expect(isValidRoomLookup('abc123')).toBe(true);
    expect(resolveRoomLookupParam('abc123')).toBe('ABC123');
  });
});
