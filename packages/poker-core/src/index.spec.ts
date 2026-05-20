import { describe, expect, it } from 'vitest';
import { createPokerCoreStub } from './index';

describe('@neonpoker/poker-core', () => {
  it('exports createPokerCoreStub', () => {
    expect(createPokerCoreStub()).toEqual({ name: 'poker-core-stub', health: 'ok' });
  });
});
