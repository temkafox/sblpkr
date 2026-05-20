import { describe, expect, it } from 'vitest';

import {
  normalizeNickname,
  validateNickname,
} from './joinValidation';

describe('joinValidation', () => {
  describe('normalizeNickname', () => {
    it('trims whitespace', () => {
      expect(normalizeNickname('  alice  ')).toBe('alice');
    });
  });

  describe('validateNickname', () => {
    it('accepts valid nicknames', () => {
      expect(validateNickname('abc')).toEqual({ ok: true });
      expect(validateNickname('Player_One')).toEqual({ ok: true });
      expect(validateNickname('Neo-77')).toEqual({ ok: true });
      expect(validateNickname('a'.repeat(20))).toEqual({ ok: true });
    });

    it('rejects too short after trim-implied checks', () => {
      expect(validateNickname('ab').ok).toBe(false);
    });

    it('rejects too long', () => {
      expect(validateNickname('a'.repeat(21)).ok).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(validateNickname('no spaces').ok).toBe(false);
      expect(validateNickname('bad.dot').ok).toBe(false);
      expect(validateNickname('unicode★').ok).toBe(false);
    });
  });
});
