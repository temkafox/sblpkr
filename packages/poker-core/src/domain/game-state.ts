import type { PlayerId } from './seat';

import type { HandState } from './hand-state';
import type { InitialPlayerParams, PlayerRuntimeState } from './player-state';
import { createInitialPlayerState } from './player-state';
import type { TableConfig, TableState } from './table-state';
import { createInitialTableState } from './table-state';

/** Single authoritative core blob — distinct from `@neonpoker/shared` wire `GameState`. */

export type CoreGameState = {
  readonly table: TableState;
  readonly hand: HandState | null;
  readonly playersById: Readonly<Record<PlayerId, PlayerRuntimeState>>;
};

export type InitialGameConfig = {
  readonly table: TableConfig;
  readonly players?: readonly InitialPlayerParams[];
};

/** Seat roster + optional seated players — **no** deal / blinds / street setup. */

export function createInitialGameState(config: InitialGameConfig): CoreGameState {
  const baseTable = createInitialTableState(config.table);
  const playersById: Record<PlayerId, PlayerRuntimeState> = Object.create(null);

  if (!config.players?.length) {
    return Object.freeze({
      table: baseTable,
      hand: null,
      playersById: Object.freeze(playersById),
    });
  }

  const seatToPlayer = new Map<number, PlayerId>();

  for (const p of config.players) {
    if (p.seatIndex < 0 || p.seatIndex >= config.table.maxSeats) {
      throw new RangeError(`seatIndex ${p.seatIndex} out of range`);
    }
    if (seatToPlayer.has(p.seatIndex)) {
      throw new Error(`duplicate seat assignment ${p.seatIndex}`);
    }
    seatToPlayer.set(p.seatIndex, p.playerId);

    if (playersById[p.playerId]) {
      throw new Error(`duplicate playerId ${p.playerId}`);
    }

    playersById[p.playerId] = createInitialPlayerState(p);
  }

  const seats = baseTable.seats.map((s) =>
    Object.freeze({
      seatIndex: s.seatIndex,
      playerId: seatToPlayer.get(s.seatIndex) ?? null,
    }),
  );

  const table = Object.freeze({
    ...baseTable,
    seats: Object.freeze(seats),
  });

  return Object.freeze({
    table,
    hand: null,
    playersById: Object.freeze(playersById),
  });
}
