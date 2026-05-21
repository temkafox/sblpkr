import type { ChatMessage } from '@neonpoker/shared';

/** Readable neon chat tones — each maps to a dedicated CSS class. */
export const CHAT_PLAYER_TONES = [
  'cyan',
  'magenta',
  'pink',
  'violet',
  'green',
  'amber',
  'blue',
  'orange',
] as const;

export type ChatPlayerTone = (typeof CHAT_PLAYER_TONES)[number];

/** Stable identity for chat color — playerId preferred, nickname fallback. */
export function getChatPlayerColorKey(
  message: Pick<ChatMessage, 'playerId' | 'nickname'>,
): string {
  const playerId = message.playerId.trim();
  if (playerId.length > 0) {
    return `id:${playerId}`;
  }
  return `nick:${message.nickname.trim().toLowerCase()}`;
}

/** FNV-1a style hash for even spread across the palette. */
function hashStringToIndex(key: string, modulo: number): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % modulo;
}

/** Deterministic chat tone for a player — stable across refresh and messages. */
export function getChatPlayerTone(colorKey: string): ChatPlayerTone {
  return CHAT_PLAYER_TONES[hashStringToIndex(colorKey, CHAT_PLAYER_TONES.length)]!;
}
