export type { Card, Rank, Suit } from './domain/card';

export type { RandomSource } from './domain/random';
export { createSeededRandom } from './domain/random';

export {
  assertUniqueDeck,
  createDeck,
  createShuffledDeck,
  shuffleDeck,
} from './domain/deck';

export type { PlayerId, Seat, SeatIndex } from './domain/seat';

export type {
  InitialPlayerParams,
  PlayerRuntimeState,
} from './domain/player-state';
export { createInitialPlayerState } from './domain/player-state';

export type { TableConfig, TableState } from './domain/table-state';
export { createInitialTableState } from './domain/table-state';

export type { HandState } from './domain/hand-state';

export type { CoreGameState, InitialGameConfig } from './domain/game-state';
export { createInitialGameState } from './domain/game-state';

export type { CorePlayerAction } from './domain/player-action';

export {
  InvalidActionError,
  InvalidTableStateError,
  CannotCallError,
  CannotCheckError,
  CannotRaiseError,
  InsufficientChipsError,
  NotEnoughPlayersError,
  OutOfTurnError,
  PokerCoreError,
  SeatNotFoundError,
} from './engine/errors';

export {
  getActiveSeatIndexes,
  getActiveSeatOrderClockwiseFrom,
  getBigBlindSeatIndex,
  getFirstToActPreflop,
  getNextActiveSeatIndex,
  getNextOccupiedSeatIndex,
  getOccupiedSeatIndexes,
  getPlayerAtSeat,
  getSmallBlindSeatIndex,
} from './engine/seat-utils';

export { startHand } from './engine/start-hand';
export type { StartHandOptions } from './engine/start-hand';

export type { CoreAvailableActions } from './engine/available-actions';
export { getAvailableActions } from './engine/available-actions';

export { applyAction } from './engine/actions';

export {
  advanceTurnAfterAction,
  isBettingRoundComplete,
  needsToAct,
} from './engine/betting-round';
