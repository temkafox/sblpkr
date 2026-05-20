import type { CoreGameState } from '../domain/game-state';
import type { PlayerRuntimeState } from '../domain/player-state';
import type { SeatIndex } from '../domain/seat';
import { SeatNotFoundError } from './errors';

export function getPlayerAtSeat(
  state: CoreGameState,
  seatIndex: SeatIndex,
): PlayerRuntimeState | null {
  const seat = state.table.seats[seatIndex];
  if (!seat || seat.playerId == null) return null;
  return state.playersById[seat.playerId] ?? null;
}

export function getOccupiedSeatIndexes(state: CoreGameState): SeatIndex[] {
  const out: SeatIndex[] = [];
  for (const s of state.table.seats) {
    if (s.playerId != null) out.push(s.seatIndex);
  }
  return out.sort((a, b) => a - b);
}

/** Seated players who are not sitting out — eligible to receive cards / post blinds. */

export function getActiveSeatIndexes(state: CoreGameState): SeatIndex[] {
  const out: SeatIndex[] = [];
  for (const s of state.table.seats) {
    const p = getPlayerAtSeat(state, s.seatIndex);
    if (p != null && !p.isSittingOut) out.push(s.seatIndex);
  }
  return out.sort((a, b) => a - b);
}

/** Next occupied seat clockwise (strictly after `fromSeatIndex`). */

export function getNextOccupiedSeatIndex(
  state: CoreGameState,
  fromSeatIndex: SeatIndex,
): SeatIndex {
  const max = state.table.maxSeats;
  for (let step = 1; step <= max; step++) {
    const seat = (fromSeatIndex + step) % max;
    if (getPlayerAtSeat(state, seat) != null) return seat;
  }
  throw new SeatNotFoundError('No occupied seat found');
}

/** Next active (non–sit-out) seat clockwise — strictly after `fromSeatIndex`. */

export function getNextActiveSeatIndex(
  state: CoreGameState,
  fromSeatIndex: SeatIndex,
): SeatIndex {
  const max = state.table.maxSeats;
  for (let step = 1; step <= max; step++) {
    const seat = (fromSeatIndex + step) % max;
    const p = getPlayerAtSeat(state, seat);
    if (p != null && !p.isSittingOut) return seat;
  }
  throw new SeatNotFoundError('No active seat found');
}

function isHeadsUpActive(state: CoreGameState): boolean {
  return getActiveSeatIndexes(state).length === 2;
}

/** Heads-up: SB is the dealer button. Otherwise first active seat left of dealer. */

export function getSmallBlindSeatIndex(
  state: CoreGameState,
  dealerSeatIndex: SeatIndex,
): SeatIndex {
  if (isHeadsUpActive(state)) return dealerSeatIndex;
  return getNextActiveSeatIndex(state, dealerSeatIndex);
}

/** Always the next active seat clockwise from SB — covers heads-up + multiway. */

export function getBigBlindSeatIndex(
  state: CoreGameState,
  smallBlindSeatIndex: SeatIndex,
): SeatIndex {
  return getNextActiveSeatIndex(state, smallBlindSeatIndex);
}

/**
 * Heads-up preflop: first actor is dealer/SB.
 * 3+: first actor is active UTG — first active seat left of BB.
 */

export function getFirstToActPreflop(state: CoreGameState): SeatIndex {
  const dealer = state.table.dealerSeatIndex;
  const sb = getSmallBlindSeatIndex(state, dealer);
  const bb = getBigBlindSeatIndex(state, sb);

  if (isHeadsUpActive(state)) return dealer;

  return getNextActiveSeatIndex(state, bb);
}

/** Active seats in clockwise order starting at `startSeat` (inclusive lap). */

export function getActiveSeatOrderClockwiseFrom(
  state: CoreGameState,
  startSeat: SeatIndex,
): SeatIndex[] {
  const max = state.table.maxSeats;
  const out: SeatIndex[] = [];
  for (let offset = 0; offset < max; offset++) {
    const seat = (startSeat + offset) % max;
    const p = getPlayerAtSeat(state, seat);
    if (p != null && !p.isSittingOut) out.push(seat);
  }
  return out;
}
