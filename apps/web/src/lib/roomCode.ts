/** Phase 1D — pseudo room codes only (no backend). */

const ROOM_CODE_BODY = /^[A-Z0-9]{4,12}$/;
const INVITE_PATH_RE = /\/(?:room|table)\/([a-zA-Z0-9]{4,12})\b/i;

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Prefer extracting `/room/<code>` or `/table/<code>` when pasting full URLs or paths. */
export function extractRoomCodeFromPaste(input: string): string {
  const t = input.trim();
  const m = t.match(INVITE_PATH_RE);
  if (m?.[1]) {
    return m[1].toUpperCase();
  }
  return normalizeRoomCode(t);
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_BODY.test(code);
}

/** Six-character uppercase A–Z / 0–9 pseudo-room id for local Phase 1D flow only. */
export function createLocalRoomCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  return out;
}
