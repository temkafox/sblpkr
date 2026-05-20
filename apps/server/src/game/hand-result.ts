import type { CoreGameState, ShowdownResult } from '@neonpoker/poker-core';
import {
  computeShowdownResult,
  getNonFoldedSeatIndexes,
  HandCategory,
  syncPotsFromCommitments,
} from '@neonpoker/poker-core';
import type { HandResultPayload } from '@neonpoker/shared';

/** Maps poker-core hand category to a short UI label. */

export function handCategoryLabel(category: HandCategory): string {
  switch (category) {
    case HandCategory.RoyalFlush:
      return 'Royal Flush';
    case HandCategory.StraightFlush:
      return 'Straight Flush';
    case HandCategory.FourOfAKind:
      return 'Four of a Kind';
    case HandCategory.FullHouse:
      return 'Full House';
    case HandCategory.Flush:
      return 'Flush';
    case HandCategory.Straight:
      return 'Straight';
    case HandCategory.ThreeOfAKind:
      return 'Three of a Kind';
    case HandCategory.TwoPair:
      return 'Two Pair';
    case HandCategory.OnePair:
      return 'One Pair';
    default:
      return 'High Card';
  }
}

function aggregateAwards(
  result: ShowdownResult,
): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  for (const pr of result.potResults) {
    for (const [seatKey, amount] of Object.entries(
      pr.awardedAmountsBySeatIndex,
    )) {
      if (amount == null || amount <= 0) continue;
      out[seatKey] = (out[seatKey] ?? 0) + amount;
    }
  }
  return out;
}

function primaryWinningHandLabel(result: ShowdownResult): string | null {
  for (const pr of result.potResults) {
    if (pr.winningHand != null) {
      return handCategoryLabel(pr.winningHand.category);
    }
  }
  return null;
}

/** Builds wire-safe hand result — no deck, no hole cards. */

export function buildHandResultPayload(
  handId: string,
  result: ShowdownResult,
  isFoldWin: boolean,
): HandResultPayload {
  const awardedAmountsBySeatIndex = aggregateAwards(result);

  return {
    handId,
    winnerSeatIndexes: [...result.winners],
    awardedAmountsBySeatIndex,
    totalAwarded: result.totalAwarded,
    isFoldWin,
    winningHandLabel: isFoldWin ? null : primaryWinningHandLabel(result),
    potResults: result.potResults.map((pr) => ({
      potIndex: pr.potIndex,
      amount: pr.amount,
      winningSeatIndexes: [...pr.winningSeatIndexes],
      awardedAmountsBySeatIndex: Object.fromEntries(
        Object.entries(pr.awardedAmountsBySeatIndex).filter(
          (entry): entry is [string, number] => entry[1] != null && entry[1] > 0,
        ),
      ),
      winningHandLabel:
        pr.winningHand != null
          ? handCategoryLabel(pr.winningHand.category)
          : null,
    })),
  };
}

/** Computes summary from pre-settlement core state. */

export function computeHandResultPayload(
  state: CoreGameState,
): HandResultPayload | null {
  const hand = state.hand;
  if (hand == null) return null;

  const synced = syncPotsFromCommitments(state);
  const isFoldWin = getNonFoldedSeatIndexes(synced).length === 1;

  try {
    const result = computeShowdownResult(state);
    return buildHandResultPayload(hand.handId, result, isFoldWin);
  } catch {
    return null;
  }
}

/** Reads cached payload or returns null when hand is not complete. */

export function extractHandResult(
  state: CoreGameState,
  cached: HandResultPayload | null = null,
): HandResultPayload | null {
  const hand = state.hand;
  if (hand == null || !hand.isComplete) {
    return null;
  }

  if (cached != null && cached.handId === hand.handId) {
    return cached;
  }

  return null;
}
