import type { Rank } from './card';

const RANK_SET = new Set<Rank>([
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
]);

/** Wire/UI aliases mapped to canonical {@link Rank} literals. */
const RANK_ALIASES: Readonly<Record<string, Rank>> = Object.freeze({
  T: '10',
  t: '10',
});

/**
 * Normalizes shorthand ranks (e.g. `T` → `10`) for evaluator and showdown paths.
 * @throws Error when the rank cannot be mapped to a legal hold'em rank.
 */
export function normalizeRank(rank: string): Rank {
  const mapped = (RANK_ALIASES[rank] ?? rank) as Rank;
  if (!RANK_SET.has(mapped)) {
    throw new Error(`Unknown card rank: ${rank}`);
  }
  return mapped;
}

export function isKnownRank(rank: string): rank is Rank {
  try {
    normalizeRank(rank);
    return true;
  } catch {
    return false;
  }
}
