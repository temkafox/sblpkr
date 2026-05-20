import type { Card, Rank, Suit } from '@neonpoker/shared';

import { normalizeRank } from '../domain/normalize-rank';
import { DuplicateCardError, InvalidHandError } from './errors';

/** Weakest → strongest for `compareEvaluatedHands` / `categoryRank`. */

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export type EvaluatedHand = {
  readonly category: HandCategory;
  /** Same numeric value as `category` — explicit for APIs / logging. */
  readonly categoryRank: number;
  readonly cards: readonly Card[];
  readonly tiebreakers: readonly number[];
  readonly label?: string;
};

const RANKS_ASC: readonly Rank[] = [
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
] as const;

const RANK_TO_NUM: Readonly<Record<Rank, number>> = Object.freeze(
  Object.fromEntries(RANKS_ASC.map((r, i) => [r, i + 2])) as Record<
    Rank,
    number
  >,
);

const NUM_TO_RANK: Readonly<Record<number, Rank>> = Object.freeze(
  Object.fromEntries(RANKS_ASC.map((r, i) => [i + 2, r])) as Record<
    number,
    Rank
  >,
);

const SUIT_ORDER: Readonly<Record<Suit, number>> = Object.freeze({
  c: 0,
  d: 1,
  h: 2,
  s: 3,
});

function rankToNum(r: Rank | string): number {
  const normalized = normalizeRank(String(r));
  const value = RANK_TO_NUM[normalized];
  if (value == null) {
    throw new InvalidHandError(`Unknown card rank: ${r}`);
  }
  return value;
}

function normalizeCard(c: Card): Card {
  return Object.freeze({
    r: normalizeRank(c.r),
    s: c.s,
  });
}

function normalizeCards(cards: readonly Card[]): readonly Card[] {
  return Object.freeze(cards.map(normalizeCard));
}

function cardKey(c: Card): string {
  return `${c.r}\0${c.s}`;
}

/** Sort strongest first; stable tie-break by suit for determinism. */

function sortCardsStrengthDesc(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const dr = rankToNum(b.r) - rankToNum(a.r);
    if (dr !== 0) return dr;
    return SUIT_ORDER[a.s] - SUIT_ORDER[b.s];
  });
}

function combinations5(cards: readonly Card[]): Card[][] {
  const n = cards.length;
  const out: Card[][] = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          for (let e = d + 1; e < n; e++) {
            out.push([
              cards[a]!,
              cards[b]!,
              cards[c]!,
              cards[d]!,
              cards[e]!,
            ]);
          }
        }
      }
    }
  }
  return out;
}

function assertNoDuplicateCards(cards: readonly Card[]): void {
  const seen = new Set<string>();
  for (const c of cards) {
    const k = cardKey(c);
    if (seen.has(k)) {
      throw new DuplicateCardError(`Duplicate card: ${c.r}${c.s}`);
    }
    seen.add(k);
  }
}

function isFlush5(cards: readonly Card[]): boolean {
  const s0 = cards[0]!.s;
  return cards.every((c) => c.s === s0);
}

/**
 * Returns high rank of a 5-card straight, or `null`.
 * Ace may be low only for wheel A-2-3-4-5 → **5-high** (`5`).
 */

function straightHigh5(cards: readonly Card[]): number | null {
  const nums = cards.map((c) => rankToNum(c.r));
  const uniq = [...new Set(nums)];
  if (uniq.length !== 5) return null;
  uniq.sort((x, y) => x - y);
  const low = uniq[0]!;
  const high = uniq[4]!;
  if (low === 2 && uniq[1] === 3 && uniq[2] === 4 && uniq[3] === 5 && high === 14) {
    return 5;
  }
  if (high - low === 4) return high;
  return null;
}

function isRoyalRankSet(cards: readonly Card[]): boolean {
  const want = new Set([10, 11, 12, 13, 14]);
  const have = new Set(cards.map((c) => rankToNum(c.r)));
  if (have.size !== 5) return false;
  for (const v of want) {
    if (!have.has(v)) return false;
  }
  return true;
}

type RankCount = { readonly rank: number; readonly count: number };

function rankCountsDesc(cards: readonly Card[]): RankCount[] {
  const tally: number[] = Array(15).fill(0);
  for (const c of cards) {
    tally[rankToNum(c.r)] += 1;
  }
  const out: RankCount[] = [];
  for (let r = 2; r <= 14; r++) {
    if (tally[r]! > 0) out.push({ rank: r, count: tally[r]! });
  }
  out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.rank - a.rank;
  });
  return out;
}

function labelRank(n: number): string {
  const r = NUM_TO_RANK[n]!;
  if (r === 'A') return 'Ace';
  if (r === 'K') return 'King';
  if (r === 'Q') return 'Queen';
  if (r === 'J') return 'Jack';
  return r;
}

function evaluateFiveCards(cardsInput: readonly Card[]): EvaluatedHand {
  const cards = sortCardsStrengthDesc(cardsInput);
  const rc = rankCountsDesc(cards);
  const flush = isFlush5(cards);
  const strHigh = straightHigh5(cards);

  if (flush && strHigh !== null) {
    if (isRoyalRankSet(cards)) {
      return Object.freeze({
        category: HandCategory.RoyalFlush,
        categoryRank: HandCategory.RoyalFlush,
        cards,
        tiebreakers: Object.freeze([14]),
        label: 'Royal Flush',
      });
    }
    return Object.freeze({
      category: HandCategory.StraightFlush,
      categoryRank: HandCategory.StraightFlush,
      cards,
      tiebreakers: Object.freeze([strHigh]),
      label: `Straight Flush, ${labelRank(strHigh)}-high`,
    });
  }

  if (rc[0]!.count === 4) {
    const quad = rc[0]!.rank;
    const kicker = rc[1]!.rank;
    return Object.freeze({
      category: HandCategory.FourOfAKind,
      categoryRank: HandCategory.FourOfAKind,
      cards,
      tiebreakers: Object.freeze([quad, kicker]),
      label: `Four of a Kind, ${labelRank(quad)}s`,
    });
  }

  if (rc[0]!.count === 3 && rc[1]!.count === 2) {
    const trips = rc[0]!.rank;
    const pair = rc[1]!.rank;
    return Object.freeze({
      category: HandCategory.FullHouse,
      categoryRank: HandCategory.FullHouse,
      cards,
      tiebreakers: Object.freeze([trips, pair]),
      label: `Full House, ${labelRank(trips)}s full of ${labelRank(pair)}s`,
    });
  }

  if (flush) {
    const tb = rc.map((x) => x.rank);
    return Object.freeze({
      category: HandCategory.Flush,
      categoryRank: HandCategory.Flush,
      cards,
      tiebreakers: Object.freeze(tb),
      label: `Flush, ${labelRank(tb[0]!)}-high`,
    });
  }

  if (strHigh !== null) {
    return Object.freeze({
      category: HandCategory.Straight,
      categoryRank: HandCategory.Straight,
      cards,
      tiebreakers: Object.freeze([strHigh]),
      label: `Straight, ${labelRank(strHigh)}-high`,
    });
  }

  if (rc[0]!.count === 3) {
    const t = rc[0]!.rank;
    const k1 = rc[1]!.rank;
    const k2 = rc[2]!.rank;
    return Object.freeze({
      category: HandCategory.ThreeOfAKind,
      categoryRank: HandCategory.ThreeOfAKind,
      cards,
      tiebreakers: Object.freeze([t, k1, k2]),
      label: `Three of a Kind, ${labelRank(t)}s`,
    });
  }

  if (rc[0]!.count === 2 && rc[1]!.count === 2) {
    const hi = rc[0]!.rank;
    const lo = rc[1]!.rank;
    const kickerCard = cards.find(
      (c) => rankToNum(c.r) !== hi && rankToNum(c.r) !== lo,
    );
    const k = rc[2]?.rank ?? (kickerCard != null ? rankToNum(kickerCard.r) : 0);
    if (kickerCard == null && rc[2] == null) {
      throw new InvalidHandError(
        'Two pair evaluation requires five distinct ranked cards',
      );
    }
    return Object.freeze({
      category: HandCategory.TwoPair,
      categoryRank: HandCategory.TwoPair,
      cards,
      tiebreakers: Object.freeze([hi, lo, k]),
      label: `Two Pair, ${labelRank(hi)}s and ${labelRank(lo)}s`,
    });
  }

  if (rc[0]!.count === 2) {
    const p = rc[0]!.rank;
    const kickers = rc.slice(1).map((x) => x.rank);
    return Object.freeze({
      category: HandCategory.OnePair,
      categoryRank: HandCategory.OnePair,
      cards,
      tiebreakers: Object.freeze([p, ...kickers]),
      label: `Pair of ${labelRank(p)}s`,
    });
  }

  const kickers = rc.map((x) => x.rank);
  return Object.freeze({
    category: HandCategory.HighCard,
    categoryRank: HandCategory.HighCard,
    cards,
    tiebreakers: Object.freeze(kickers),
    label: `High Card, ${labelRank(kickers[0]!)}`,
  });
}

function pickStrongerEval(current: EvaluatedHand, candidate: EvaluatedHand): EvaluatedHand {
  const cmp = compareEvaluatedHands(candidate, current);
  return cmp > 0 ? candidate : current;
}

/**
 * Evaluates the best 5-card Hold'em hand from 5–7 distinct cards.
 *
 * @throws {InvalidHandError} Wrong card count.
 * @throws {DuplicateCardError} Duplicate `(rank,suit)` in input.
 */

export function evaluateBestHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new InvalidHandError(
      `evaluateBestHand expects 5–7 cards, got ${cards.length}`,
    );
  }
  const normalized = normalizeCards(cards);
  assertNoDuplicateCards(normalized);

  const combos = combinations5(normalized);
  let best = evaluateFiveCards(combos[0]!);
  for (let i = 1; i < combos.length; i++) {
    best = pickStrongerEval(best, evaluateFiveCards(combos[i]!));
  }
  return best;
}

/**
 * Comparator for showdown ordering (without implementing showdown itself).
 *
 * @returns `> 0` if **a** beats **b**, `< 0` if **b** beats **a**, `0` tie.
 */

export function compareEvaluatedHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.categoryRank !== b.categoryRank) {
    return a.categoryRank - b.categoryRank;
  }
  const ta = a.tiebreakers;
  const tb = b.tiebreakers;
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i++) {
    const va = ta[i] ?? 0;
    const vb = tb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/** Convenience: evaluate each side then compare (still pure — clones internally via evaluate). */

export function compareHands(cardsA: readonly Card[], cardsB: readonly Card[]): number {
  return compareEvaluatedHands(
    evaluateBestHand(cardsA),
    evaluateBestHand(cardsB),
  );
}
