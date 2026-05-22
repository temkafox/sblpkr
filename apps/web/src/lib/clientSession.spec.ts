import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearClientSessionIdForTests,
  createClientSessionId,
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

  it('createClientSessionId works without crypto.randomUUID', () => {
    const orig = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
    try {
      const id = createClientSessionId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        value: orig,
      });
    }
  });
});
