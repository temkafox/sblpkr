import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialGameState,
  createSeededRandom,
  HandCategory,
  startHand,
} from '@neonpoker/poker-core';

import { progressGameState } from './game-progress';
import {
  buildHandResultPayload,
  computeHandResultPayload,
  extractHandResult,
  handCategoryLabel,
} from './hand-result';

const rng = createSeededRandom('hand-result-spec');

function huStarted() {
  const base = createInitialGameState({
    table: {
      tableId: 'hu',
      maxSeats: 4,
      smallBlind: 1,
      bigBlind: 2,
    },
    players: [
      { playerId: 'sb', seatIndex: 0, startingChips: 200 },
      { playerId: 'bb', seatIndex: 3, startingChips: 200 },
    ],
  });
  return startHand(
    {
      ...base,
      table: { ...base.table, dealerSeatIndex: 3 },
    },
    { rng },
  );
}

describe('hand-result', () => {
  it('handCategoryLabel maps categories to UI strings', () => {
    expect(handCategoryLabel(HandCategory.FullHouse)).toBe('Full House');
  });

  it('computeHandResultPayload includes awards for fold win', () => {
    let g = huStarted();
    const sb = g.table.activeSeatIndex!;
    g = applyAction(g, sb, { kind: 'call' });
    const bb = g.table.activeSeatIndex!;
    g = applyAction(g, bb, { kind: 'fold' });

    const payload = computeHandResultPayload(g);
    expect(payload).not.toBeNull();
    expect(payload!.isFoldWin).toBe(true);
    expect(payload!.winnerSeatIndexes).toContain(sb);
    expect(payload!.totalAwarded).toBeGreaterThan(0);
    expect(payload!.awardedAmountsBySeatIndex[String(sb)]).toBeGreaterThan(0);
    expect(payload).not.toHaveProperty('deck');
    expect(payload).not.toHaveProperty('holeCards');
  });

  it('extractHandResult returns cached payload for completed hand', () => {
    let g = huStarted();
    const sb = g.table.activeSeatIndex!;
    g = applyAction(g, sb, { kind: 'call' });
    const bb = g.table.activeSeatIndex!;
    g = applyAction(g, bb, { kind: 'fold' });
    const { state, showdownResult, isFoldWin } = progressGameState(g);
    expect(state.hand?.isComplete).toBe(true);

    const built = buildHandResultPayload(
      state.hand!.handId,
      showdownResult!,
      isFoldWin,
    );

    const extracted = extractHandResult(state, built);
    expect(extracted).toEqual(built);
  });
});
