const STORAGE_KEY = 'neonpoker:clientSessionId';

/** Stable browser tab identity for MVP reconnect (survives F5). */
export function getOrCreateClientSessionId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing != null && existing.length > 0) {
      return existing;
    }
  } catch {
    /* private mode / blocked storage */
  }

  const id = crypto.randomUUID();
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* best-effort persist */
  }
  return id;
}

/** Test helper — resets persisted client session. */
export function clearClientSessionIdForTests(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
