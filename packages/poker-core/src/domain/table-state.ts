import type { Seat, SeatIndex } from './seat';

/** Static table configuration — stakes only; rotation logic is Phase 4. */

export type TableConfig = {
  readonly tableId: string;
  readonly maxSeats: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
};

/** Mutable roster / pointer slots — indexes are placeholders until `startHand`. */

export type TableState = {
  readonly tableId: string;
  readonly maxSeats: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly dealerSeatIndex: SeatIndex;
  readonly smallBlindSeatIndex: SeatIndex;
  readonly bigBlindSeatIndex: SeatIndex;
  readonly activeSeatIndex: SeatIndex | null;
  readonly seats: readonly Seat[];
};

/** Empty ring — dealer/SB/BB/active default to seat **0** (corrected later by rules). */

export function createInitialTableState(config: TableConfig): TableState {
  if (config.maxSeats < 2 || config.maxSeats > 9) {
    throw new RangeError('maxSeats must be between 2 and 9');
  }

  const seats: Seat[] = [];
  for (let i = 0; i < config.maxSeats; i++) {
    seats.push(Object.freeze({ seatIndex: i, playerId: null }));
  }

  return Object.freeze({
    tableId: config.tableId,
    maxSeats: config.maxSeats,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 0,
    activeSeatIndex: 0,
    seats: Object.freeze(seats),
  });
}
