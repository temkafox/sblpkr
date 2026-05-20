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
  DuplicateCardError,
  InvalidActionError,
  InvalidHandError,
  InvalidTableStateError,
  CannotCallError,
  CannotCheckError,
  CannotRaiseError,
  InsufficientChipsError,
  NoEligibleWinnersError,
  NotEnoughPlayersError,
  OutOfTurnError,
  PokerCoreError,
  PotDistributionError,
  SeatNotFoundError,
  ShowdownNotReadyError,
} from './engine/errors';

export type { EvaluatedHand } from './engine/hand-evaluator';
export {
  compareEvaluatedHands,
  compareHands,
  evaluateBestHand,
  HandCategory,
} from './engine/hand-evaluator';

export type { AwardedAmountsBySeatIndex } from './engine/pot-distribution';
export {
  getOddChipWinner,
  orderWinnersClockwiseFromDealer,
  splitPotWithOddChipRule,
} from './engine/pot-distribution';

export type { PotResult, ShowdownResult } from './engine/showdown';
export {
  determineShowdownWinners,
  distributePots,
  resolveFoldWin,
  resolveShowdown,
} from './engine/showdown';

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
  applyAggressiveBetMetadata,
  getMaximumRaiseTarget,
  getMinimumRaiseTarget,
  getRaiseSize,
  isFullRaise,
} from './engine/min-raise';

export {
  advanceStreet,
  canAdvanceStreet,
  getFirstToActPostflop,
} from './engine/street';

export {
  advanceTurnAfterAction,
  isBettingRoundComplete,
  needsToAct,
} from './engine/betting-round';

export type { SeatChipSlice, SidePot } from '@neonpoker/shared';

export type { SidePotBreakdown } from './engine/side-pots';

export {
  calculateSidePotBreakdown,
  calculateSidePots,
  getContributorSeatIndexesForLevel,
  getEligibleSeatIndexesForLevel,
  getTotalCommitted,
  syncPotsFromCommitments,
} from './engine/side-pots';
