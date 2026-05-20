/** Phase 1D — client-side nickname checks only (no server). */

export function normalizeNickname(raw: string): string {
  return raw.trim();
}

export type NicknameValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateNickname(normalized: string): NicknameValidation {
  if (normalized.length < 3) {
    return { ok: false, message: 'Nickname must be at least 3 characters.' };
  }
  if (normalized.length > 20) {
    return { ok: false, message: 'Nickname must be at most 20 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    return {
      ok: false,
      message: 'Use letters, numbers, underscore (_), or hyphen (-) only.',
    };
  }
  return { ok: true };
}
