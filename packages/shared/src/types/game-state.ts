import type { Card } from './card';
import type { Player, PlayerId, SeatIndex } from './player';
import type { Pot } from './pot';

/** Supported ring layouts — mirrors UI presets. */

export type SeatCount = 2 | 4 | 6 | 9;

/** Betting street — aligns with hand-history grouping labels. */

export type Street =
  | 'PRE-FLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN';

/** Seat HUD token — drives badges, pulses, status pills (design states-map). */

export type SeatStatus =
  | 'idle'
  | 'turn'
  | 'check'
  | 'call'
  | 'raise'
  | 'fold'
  | 'allin'
  | 'winner'
  | 'sitout';

export type SeatState = {
  readonly status: SeatStatus;
  readonly bet: number;
  readonly amount?: number;
};

/** Per-seat hydrated view — optional helper shape for filtered snapshots (Phase 6D+). */

export type PlayerSeatView = {
  readonly seatIndex: SeatIndex;
  readonly player: Player | null;
  readonly holeCards: readonly Card[] | null;
  readonly seatState: SeatState;
};

/** Hero-facing affordances broadcast by the server (see Phase 4 engine analog). */

export type AvailableActions = {
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly canCall: boolean;
  readonly callAmount: number;
  readonly canRaise: boolean;
  readonly minRaise: number;
  readonly maxRaise: number;
  readonly canAllIn: boolean;
};

/** Static roster layout between hands. */

export type TableState = {
  readonly seats: SeatCount;
  readonly playerIdBySeatIndex: Record<string, PlayerId | null>;
};

/** Mutable-in-memory hand snapshot — authoritative fields only; no rule helpers here. */

export type HandState = {
  readonly street: Street;
  readonly boardCards: readonly Card[];
  readonly revealCount: 0 | 3 | 4 | 5;
  readonly dealerSeatIndex: SeatIndex;
  readonly smallBlindSeatIndex: SeatIndex;
  readonly bigBlindSeatIndex: SeatIndex;
  readonly activeSeatIndex: SeatIndex;
  readonly seatStates: Record<string, SeatState>;
  readonly pot: Pot;
  readonly toCall: number;
  readonly minRaise: number;
  readonly maxRaise: number;
  readonly canCheck: boolean;
};

/** Full authoritative payload shape exchanged after hydration / actions (rules elsewhere). */

export type GameState = {
  readonly table: TableState;
  readonly hand: HandState | null;
  readonly playersById: Record<PlayerId, Player>;
};
