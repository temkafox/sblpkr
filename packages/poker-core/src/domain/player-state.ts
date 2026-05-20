import type { Card } from './card';
import type { PlayerId, SeatIndex } from './seat';

/** Authoritative per‑player chips / commitment snapshot — mutated only via future transitions. */

export type PlayerRuntimeState = {
  readonly playerId: PlayerId;
  readonly seatIndex: SeatIndex;
  readonly chips: number;
  readonly holeCards: readonly Card[];
  readonly currentBet: number;
  readonly totalCommitted: number;
  readonly hasFolded: boolean;
  readonly isAllIn: boolean;
  readonly isSittingOut: boolean;
};

export type InitialPlayerParams = {
  readonly playerId: PlayerId;
  readonly seatIndex: SeatIndex;
  readonly startingChips: number;
};

/** Blank participant row — no hole cards dealt yet (Phase 4). */

export function createInitialPlayerState(
  params: InitialPlayerParams,
): PlayerRuntimeState {
  return Object.freeze({
    playerId: params.playerId,
    seatIndex: params.seatIndex,
    chips: params.startingChips,
    holeCards: Object.freeze([]),
    currentBet: 0,
    totalCommitted: 0,
    hasFolded: false,
    isAllIn: false,
    isSittingOut: false,
  });
}
