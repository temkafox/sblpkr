import { describe, expect, it } from 'vitest';

import {
  createLocalRoomCode,
  extractRoomCodeFromPaste,
  isValidRoomCode,
  normalizeRoomCode,
} from './roomCode';

describe('roomCode', () => {
  describe('normalizeRoomCode', () => {
    it('uppercases and strips non-alphanumeric', () => {
      expect(normalizeRoomCode('  ab-cd12  ')).toBe('ABCD12');
    });
  });

  describe('extractRoomCodeFromPaste', () => {
    it('extracts code from /room/ paths', () => {
      expect(extractRoomCodeFromPaste('https://app.example/room/AbCd1234')).toBe(
        'ABCD1234',
      );
      expect(extractRoomCodeFromPaste('/room/ZZZZ')).toBe('ZZZZ');
    });

    it('extracts code from /table/ paths', () => {
      expect(extractRoomCodeFromPaste('http://localhost/table/xY12')).toBe(
        'XY12',
      );
    });

    it('falls back to normalizeRoomCode when no path match', () => {
      expect(extractRoomCodeFromPaste('  aa11  ')).toBe('AA11');
    });
  });

  describe('isValidRoomCode', () => {
    it('accepts 4–12 uppercase alphanumeric', () => {
      expect(isValidRoomCode('ABCD')).toBe(true);
      expect(isValidRoomCode('ABCD12345678')).toBe(true);
    });

    it('rejects wrong lengths', () => {
      expect(isValidRoomCode('ABC')).toBe(false);
      expect(isValidRoomCode('A'.repeat(13))).toBe(false);
    });

    it('rejects lowercase / symbols after normalization expectation', () => {
      expect(isValidRoomCode('abcd')).toBe(false);
      expect(isValidRoomCode('AB-CD')).toBe(false);
    });
  });

  describe('createLocalRoomCode', () => {
    it('returns six uppercase alphanumeric chars', () => {
      for (let i = 0; i < 24; i++) {
        const code = createLocalRoomCode();
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      }
    });
  });
});
