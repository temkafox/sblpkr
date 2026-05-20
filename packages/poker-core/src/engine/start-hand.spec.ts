import { describe, expect, it } from 'vitest';

import {
  createInitialGameState,
  createSeededRandom,
  NotEnoughPlayersError,
  startHand,
} from '../index';
import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { TableState } from '../domain/table-state';

function withTablePatch(
  state: CoreGameState,
  patch: Partial<TableState>,
): CoreGameState {
  return Object.freeze({
    ...state,
    table: Object.freeze({ ...state.table, ...patch }),
  });
}

function withPlayerPatch(
  state: CoreGameState,
  playerId: string,
  patch: Partial<PlayerRuntimeState>,
): CoreGameState {
  const prev = state.playersById[playerId]!;
  return Object.freeze({
    ...state,
    playersById: Object.freeze({
      ...state.playersById,
      [playerId]: Object.freeze({ ...prev, ...patch }),
    }),
  });
}

describe('startHand', () => {
  const makeRng = () => createSeededRandom('phase4a-start-hand-tests');

  it('skips zero-chip seated players for deal and blinds', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'a', seatIndex: 0, startingChips: 500 },
        { playerId: 'b', seatIndex: 1, startingChips: 500 },
        { playerId: 'busted', seatIndex: 2, startingChips: 0 },
      ],
    });
    const bustedMarked = withPlayerPatch(base, 'busted', { isSittingOut: true });
    const started = startHand(bustedMarked, { rng: makeRng(), handId: 'h-bust' });
    expect(started.playersById.busted!.holeCards.length).toBe(0);
    expect(started.table.activeSeatIndex).not.toBe(2);
  });

  it('rejects fewer than two active players', () => {
    const lonely = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [{ playerId: 'solo', seatIndex: 2, startingChips: 50 }],
    });

    expect(() => startHand(lonely, { rng: makeRng() })).toThrow(NotEnoughPlayersError);
  });

  it('rotates dealer to next active occupied seat', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'p1', seatIndex: 1, startingChips: 500 },
        { playerId: 'p2', seatIndex: 3, startingChips: 500 },
      ],
    });

    const started = startHand(withTablePatch(base, { dealerSeatIndex: 1 }), {
      rng: makeRng(),
      handId: 'h1',
    });

    expect(started.table.dealerSeatIndex).toBe(3);
  });

  it('heads-up assigns SB to dealer and BB to other seat', () => {
    const hu = createInitialGameState({
      table: {
        tableId: 'hu',
        maxSeats: 4,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'a', seatIndex: 0, startingChips: 100 },
        { playerId: 'b', seatIndex: 3, startingChips: 100 },
      ],
    });

    const g = startHand(withTablePatch(hu, { dealerSeatIndex: 0 }), {
      rng: makeRng(),
    });

    expect(g.table.dealerSeatIndex).toBe(3);
    expect(g.table.smallBlindSeatIndex).toBe(3);
    expect(g.table.bigBlindSeatIndex).toBe(0);
  });

  it('6-max assigns SB/BB clockwise for 3 players', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'p0', seatIndex: 1, startingChips: 500 },
        { playerId: 'p1', seatIndex: 3, startingChips: 500 },
        { playerId: 'p2', seatIndex: 5, startingChips: 500 },
      ],
    });

    const g = startHand(withTablePatch(base, { dealerSeatIndex: 5 }), {
      rng: makeRng(),
    });

    expect(g.table.dealerSeatIndex).toBe(1);
    expect(g.table.smallBlindSeatIndex).toBe(3);
    expect(g.table.bigBlindSeatIndex).toBe(5);
    expect(g.table.activeSeatIndex).toBe(1);
  });

  it('deals two unique cards to each active player and skips sit-outs', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'activeA', seatIndex: 1, startingChips: 200 },
        { playerId: 'activeB', seatIndex: 2, startingChips: 200 },
        { playerId: 'idleC', seatIndex: 4, startingChips: 200 },
      ],
    });

    const g0 = withPlayerPatch(base, 'idleC', { isSittingOut: true });
    const beforeA = g0.playersById.activeA!;
    const g = startHand(g0, { rng: makeRng() });

    expect(g.playersById.activeA?.holeCards).toHaveLength(2);
    expect(g.playersById.activeB?.holeCards).toHaveLength(2);
    expect(g.playersById.idleC?.holeCards).toHaveLength(0);

    expect(beforeA.holeCards).toHaveLength(0);
    expect(beforeA.chips).toBe(200);

    const seen = new Set<string>();
    const collect = (cards: readonly { r: string; s: string }[]) => {
      for (const c of cards) {
        const key = `${c.r}${c.s}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    };

    collect(g.playersById.activeA!.holeCards);
    collect(g.playersById.activeB!.holeCards);
    for (const c of g.hand!.deck) {
      collect([c]);
    }

    expect(seen.size).toBe(52);
    expect(g.hand!.deck.length).toBe(52 - 4);
  });

  it('posts blinds, updates commitments, and wires hand meta', () => {
    const g = startHand(
      createInitialGameState({
        table: {
          tableId: 't',
          maxSeats: 6,
          smallBlind: 5,
          bigBlind: 10,
        },
        players: [
          { playerId: 'sb', seatIndex: 3, startingChips: 400 },
          { playerId: 'bb', seatIndex: 5, startingChips: 400 },
        ],
      }),
      { rng: makeRng(), handId: 'meta-hand' },
    );

    expect(g.hand?.handId).toBe('meta-hand');
    expect(g.hand?.street).toBe('PRE-FLOP');
    expect(g.hand?.boardCards).toHaveLength(0);
    expect(g.hand?.pots.total).toBe(15);
    expect(g.hand?.currentBet).toBe(10);
    expect(g.hand?.minRaise).toBe(10);
    expect(g.hand?.lastRaiseAmount).toBe(10);
    expect(g.hand?.lastAggressorSeatIndex).toBe(g.table.bigBlindSeatIndex);

    const sbSeat = g.table.smallBlindSeatIndex;
    const bbSeat = g.table.bigBlindSeatIndex;
    const sbPid = g.table.seats[sbSeat]!.playerId!;
    const bbPid = g.table.seats[bbSeat]!.playerId!;
    expect(g.playersById[sbPid]?.currentBet).toBe(5);
    expect(g.playersById[bbPid]?.currentBet).toBe(10);
    expect(g.playersById[sbPid]?.totalCommitted).toBe(5);
    expect(g.playersById[bbPid]?.totalCommitted).toBe(10);
    expect(g.playersById[sbPid]?.chips).toBe(395);
    expect(g.playersById[bbPid]?.chips).toBe(390);
  });

  it('allows short SB all-in posting only remaining chips', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 4,
        smallBlind: 10,
        bigBlind: 20,
      },
      players: [
        { playerId: 'short', seatIndex: 0, startingChips: 3 },
        { playerId: 'deep', seatIndex: 1, startingChips: 500 },
      ],
    });

    const g = startHand(withTablePatch(base, { dealerSeatIndex: 1 }), {
      rng: makeRng(),
    });

    const sbSeat = g.table.smallBlindSeatIndex;
    const sbPid = g.table.seats[sbSeat]!.playerId!;
    expect(sbPid).toBe('short');
    expect(g.playersById.short?.chips).toBe(0);
    expect(g.playersById.short?.currentBet).toBe(3);
    expect(g.playersById.short?.isAllIn).toBe(true);
    expect(g.hand?.pots.total).toBe(23);
  });

  it('does not mutate the input snapshot', () => {
    const base = createInitialGameState({
      table: {
        tableId: 't',
        maxSeats: 4,
        smallBlind: 5,
        bigBlind: 10,
      },
      players: [
        { playerId: 'a', seatIndex: 0, startingChips: 100 },
        { playerId: 'b', seatIndex: 1, startingChips: 100 },
      ],
    });

    const snapTable = { ...base.table };
    const snapP = base.playersById.a;

    const next = startHand(base, { rng: makeRng() });

    expect(base.table.dealerSeatIndex).toBe(snapTable.dealerSeatIndex);
    expect(base.hand).toBeNull();
    expect(next.table).not.toBe(base.table);
    expect(snapP?.holeCards).toHaveLength(0);
    expect(snapP?.chips).toBe(100);
  });
});
