import { describe, expect, it } from 'vitest';

import {
  applyAction,
  advanceTurnAfterAction,
  createInitialGameState,
  createSeededRandom,
  getAvailableActions,
  getHandParticipantSeatIndexes,
  needsToAct,
  NotInHandError,
  startHand,
} from '../index';

function tableWithPlayers(
  players: { playerId: string; seatIndex: number }[],
) {
  return createInitialGameState({
    table: {
      tableId: 'late-join',
      maxSeats: 3,
      smallBlind: 5,
      bigBlind: 10,
    },
    players: players.map((p) => ({
      ...p,
      startingChips: 200,
    })),
  });
}

describe('late joiner during active hand', () => {
  it('freezes participantSeatIndexes at startHand', () => {
    const started = startHand(
      tableWithPlayers([
        { playerId: 'p0', seatIndex: 0 },
        { playerId: 'p1', seatIndex: 1 },
        { playerId: 'p2', seatIndex: 2 },
      ]),
      { rng: createSeededRandom('participants') },
    );
    expect([...getHandParticipantSeatIndexes(started)].sort((a, b) => a - b)).toEqual([
      0, 1, 2,
    ]);
  });

  it('does not select late joiner as active after prior player acts', () => {
    let g = startHand(
      tableWithPlayers([
        { playerId: 'p0', seatIndex: 0 },
        { playerId: 'p1', seatIndex: 1 },
      ]),
      { rng: createSeededRandom('late-active') },
    );
    expect([...getHandParticipantSeatIndexes(g)].sort((a, b) => a - b)).toEqual([
      0, 1,
    ]);

    const lateId = 'p-late';
    const players = { ...g.playersById } as Record<
      string,
      (typeof g.playersById)[string]
    >;
    players[lateId] = Object.freeze({
      playerId: lateId,
      seatIndex: 2,
      chips: 200,
      holeCards: Object.freeze([]),
      currentBet: 0,
      totalCommitted: 0,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: true,
    });
    g = Object.freeze({
      ...g,
      playersById: Object.freeze(players),
      table: Object.freeze({
        ...g.table,
        seats: Object.freeze([
          g.table.seats[0]!,
          g.table.seats[1]!,
          Object.freeze({ seatIndex: 2, playerId: lateId }),
        ]),
      }),
    });

    expect(needsToAct(g, 2)).toBe(false);

    const actor = g.table.activeSeatIndex!;
    g = applyAction(g, actor, { kind: 'call' });
    const advanced = advanceTurnAfterAction(g);

    expect(advanced.table.activeSeatIndex).not.toBe(2);
    if (advanced.table.activeSeatIndex != null) {
      expect([0, 1]).toContain(advanced.table.activeSeatIndex);
    }
  });

  it('rejects action from seat not in participantSeatIndexes', () => {
    const started = startHand(
      tableWithPlayers([
        { playerId: 'p0', seatIndex: 0 },
        { playerId: 'p1', seatIndex: 1 },
      ]),
      {
      rng: createSeededRandom('reject-late'),
    });
    const g = Object.freeze({
      ...started,
      hand: Object.freeze({
        ...started.hand!,
        participantSeatIndexes: Object.freeze([0, 1]),
      }),
      table: Object.freeze({
        ...started.table,
        activeSeatIndex: 2,
      }),
    });

    expect(() => applyAction(g, 2, { kind: 'call' })).toThrow(NotInHandError);
    expect(getAvailableActions(g, 2).canCall).toBe(false);
  });
});
