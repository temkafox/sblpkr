import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearClientSessionIdForTests,
  getOrCreateClientSessionId,
} from './clientSession';

describe('clientSession', () => {
  beforeEach(() => {
    clearClientSessionIdForTests();
  });

  it('generates and persists clientSessionId', () => {
    const first = getOrCreateClientSessionId();
    const second = getOrCreateClientSessionId();
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});
