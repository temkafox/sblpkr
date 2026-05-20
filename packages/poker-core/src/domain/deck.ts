import type { Card, Rank, Suit } from './card';
import type { RandomSource } from './random';

const SUITS: readonly Suit[] = ['h', 'd', 's', 'c'];

const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

/** Ordered 52‑card deck — deterministic construction only (no shuffle). */

export function createDeck(): readonly Card[] {
  const out: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      out.push(Object.freeze({ r, s }));
    }
  }
  return Object.freeze(out);
}

/** Quick structural check — rules tests will rely on full uniqueness. */

export function assertUniqueDeck(deck: readonly Card[]): boolean {
  if (deck.length !== 52) return false;
  const seen = new Set<string>();
  for (const c of deck) {
    const key = `${c.r}:${c.s}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return seen.size === 52;
}

/** Fisher–Yates shuffle — copies input; **never mutates** `deck`. */

export function shuffleDeck(
  deck: readonly Card[],
  rng: RandomSource,
): readonly Card[] {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return Object.freeze(next);
}

/** Convenience — fresh ordered deck → shuffled copy. */

export function createShuffledDeck(rng: RandomSource): readonly Card[] {
  return shuffleDeck(createDeck(), rng);
}
