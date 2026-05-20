/**
 * Phase 1C visual mocks — typed fixtures derived from /design/data.jsx.
 * Not authoritative game state; replaced when shared contracts land.
 */

import { LAYOUTS, type SeatCount, type SeatPosition } from '../lib/layout';

export type Suit = 'h' | 'd' | 's' | 'c';

/** Rank label as shown on card faces */
export type CardRank = string;

export interface CardModel {
  r: CardRank;
  s: Suit;
}

export type BoardReveal = 0 | 3 | 4 | 5;

export interface HandHistoryRow {
  name: string;
  cls: 'n-c' | 'n-m' | 'n-p' | 'n-v' | 'n-g' | 'n-a' | 'n-h';
  act: string;
}

export interface HandHistoryStreet {
  street: 'PRE-FLOP' | 'FLOP' | 'TURN' | 'RIVER';
  rows: HandHistoryRow[];
}

export interface ChatMessageMock {
  who: string;
  cls: HandHistoryRow['cls'];
  msg: string;
}

export interface GameInfoMock {
  gameType: string;
  stakes: string;
  buyIn: string;
  playerCount: number;
  maxSeats: number;
  nextBreak: string;
}

export interface ActionBarMock {
  potAmount: number;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  canCheck: boolean;
  raiseDisplayAmount: number;
  sliderPct: number;
  activeQuickId: 'min' | 'half' | 'pot' | '2x' | 'all' | null;
  /** When false, ActionBar is visually disabled (Phase 7B — no emits yet). */
  actionsEnabled?: boolean;
}

export type SeatStatus =
  | 'turn'
  | 'fold'
  | 'check'
  | 'call'
  | 'raise'
  | 'allin'
  | 'winner'
  | 'sitout'
  | 'idle'
  | 'waiting';

export interface SeatStateMock {
  status: SeatStatus;
  bet: number;
  amount?: number | '';
  /** When false, opponent backcards are hidden (server has no holeCardCount). */
  showOppBackcards?: boolean;
}

export type PlayerRing = 'cyan' | 'pink' | 'magenta' | 'violet' | 'green' | 'amber';

export interface PlayerMock {
  id: string;
  name: string;
  stack: number;
  ring: PlayerRing;
  init: string;
  avatar: string | null;
}

export interface MockGameState {
  seats: SeatCount;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  activeSeatIndex: number;
}

export interface TablePageMock {
  potAmount: number;
  showPotChips: boolean;
  boardCards: CardModel[];
  boardReveal: BoardReveal;
  heroHoleCards: [CardModel, CardModel];
  handHistory: HandHistoryStreet[];
  chatMessages: ChatMessageMock[];
  gameInfo: GameInfoMock;
  actionBar: ActionBarMock;
  layout: SeatPosition[];
  playersBySeatIndex: PlayerMock[];
  seatStatesBySeatIndex: SeatStateMock[];
  gameState: MockGameState;
}

/** Dev-only: set to 2, 4, 6, or 9 — no UI toggle in Phase 1C. */
export const MOCK_SEAT_COUNT: SeatCount = 9;

const MOCK_PLAYERS_BY_ID: Record<string, PlayerMock> = {
  hero: {
    id: 'hero',
    name: 'NeonRider',
    stack: 412.75,
    ring: 'cyan',
    init: 'N',
    avatar: '/assets/avatar-1.png',
  },
  p2: {
    id: 'p2',
    name: 'SynthWave',
    stack: 175.6,
    ring: 'pink',
    init: 'S',
    avatar: null,
  },
  p3: {
    id: 'p3',
    name: 'BluffZilla',
    stack: 305.75,
    ring: 'magenta',
    init: 'B',
    avatar: '/assets/avatar-2.png',
  },
  p4: {
    id: 'p4',
    name: 'StackMaster',
    stack: 412.0,
    ring: 'magenta',
    init: 'M',
    avatar: null,
  },
  p5: {
    id: 'p5',
    name: 'CyberKing',
    stack: 238.5,
    ring: 'green',
    init: 'C',
    avatar: '/assets/avatar-3.png',
  },
  p6: {
    id: 'p6',
    name: 'LunaLove',
    stack: 199.5,
    ring: 'pink',
    init: 'L',
    avatar: '/assets/avatar-2.png',
  },
  p7: {
    id: 'p7',
    name: 'NightShade',
    stack: 187.0,
    ring: 'violet',
    init: 'NS',
    avatar: '/assets/avatar-3.png',
  },
  p8: {
    id: 'p8',
    name: 'QuickSilver',
    stack: 154.8,
    ring: 'cyan',
    init: 'Q',
    avatar: null,
  },
  p9: {
    id: 'p9',
    name: 'DataWraith',
    stack: 221.3,
    ring: 'violet',
    init: 'D',
    avatar: '/assets/avatar-1.png',
  },
};

const MOCK_STATES_BY_ID: Record<string, SeatStateMock> = {
  hero: { status: 'turn', bet: 0, amount: '' },
  p2: { status: 'fold', bet: 0, amount: '' },
  p3: { status: 'call', bet: 10, amount: 10 },
  p4: { status: 'raise', bet: 10, amount: 10 },
  p5: { status: 'check', bet: 0, amount: '' },
  p6: { status: 'fold', bet: 0, amount: '' },
  p7: { status: 'fold', bet: 0, amount: '' },
  p8: { status: 'fold', bet: 0, amount: '' },
  p9: { status: 'check', bet: 0, amount: '' },
};

function mockGameState(seatCount: SeatCount): MockGameState {
  switch (seatCount) {
    case 9:
      return {
        seats: 9,
        dealerSeatIndex: 0,
        smallBlindSeatIndex: 1,
        bigBlindSeatIndex: 2,
        activeSeatIndex: 0,
      };
    case 6:
      return {
        seats: 6,
        dealerSeatIndex: 0,
        smallBlindSeatIndex: 1,
        bigBlindSeatIndex: 2,
        activeSeatIndex: 0,
      };
    case 4:
      return {
        seats: 4,
        dealerSeatIndex: 0,
        smallBlindSeatIndex: 1,
        bigBlindSeatIndex: 2,
        activeSeatIndex: 0,
      };
    case 2:
      return {
        seats: 2,
        dealerSeatIndex: 0,
        smallBlindSeatIndex: 0,
        bigBlindSeatIndex: 1,
        activeSeatIndex: 0,
      };
    default: {
      const x: never = seatCount;
      throw new Error(`unsupported seat count: ${String(x)}`);
    }
  }
}

function injectActiveSeat(states: SeatStateMock[], activeIdx: number): SeatStateMock[] {
  return states.map((s, i) => {
    if (i === activeIdx) return { ...s, status: 'turn' };
    if (s.status === 'turn') return { ...s, status: 'idle' };
    return s;
  });
}

function buildSeatMocks(count: SeatCount): {
  layout: SeatPosition[];
  playersBySeatIndex: PlayerMock[];
  seatStatesBySeatIndex: SeatStateMock[];
  gameState: MockGameState;
} {
  const layout = LAYOUTS[count];
  const playersBySeatIndex = layout.map((pos) => MOCK_PLAYERS_BY_ID[pos.id]!);
  const rawStates = layout.map((pos) => {
    const base = MOCK_STATES_BY_ID[pos.id] ?? { status: 'idle', bet: 0 };
    return { ...base };
  });
  const gameState = mockGameState(count);
  const seatStatesBySeatIndex = injectActiveSeat(rawStates, gameState.activeSeatIndex);

  return { layout, playersBySeatIndex, seatStatesBySeatIndex, gameState };
}

function buildTablePageMock(): TablePageMock {
  const count = MOCK_SEAT_COUNT;
  const { layout, playersBySeatIndex, seatStatesBySeatIndex, gameState } = buildSeatMocks(count);

  return {
    potAmount: 34.5,
    showPotChips: true,
    boardCards: [
      { r: '10', s: 'h' },
      { r: 'J', s: 'c' },
      { r: 'Q', s: 'd' },
      { r: '2', s: 's' },
      { r: '7', s: 'h' },
    ],
    boardReveal: 5,
    heroHoleCards: [
      { r: 'A', s: 's' },
      { r: 'K', s: 'h' },
    ],
    handHistory: [
      {
        street: 'PRE-FLOP',
        rows: [
          { name: 'StackMaster', cls: 'n-m', act: 'Raise to $6' },
          { name: 'BluffZilla', cls: 'n-c', act: 'Call $6' },
          { name: 'NeonRider', cls: 'n-c', act: 'Call $6' },
          { name: 'CyberKing', cls: 'n-h', act: 'Call $6' },
          { name: 'LunaLove', cls: 'n-p', act: 'Fold' },
          { name: 'NightShade', cls: 'n-p', act: 'Fold' },
          { name: 'QuickSilver', cls: 'n-p', act: 'Fold' },
          { name: 'DataWraith', cls: 'n-p', act: 'Fold' },
          { name: 'SynthWave', cls: 'n-p', act: 'Fold' },
        ],
      },
      {
        street: 'FLOP',
        rows: [
          { name: 'StackMaster', cls: 'n-m', act: 'Bet $10' },
          { name: 'BluffZilla', cls: 'n-c', act: 'Call $10' },
          { name: 'NeonRider', cls: 'n-c', act: 'Call $10' },
          { name: 'CyberKing', cls: 'n-h', act: 'Check' },
        ],
      },
      {
        street: 'TURN',
        rows: [
          { name: 'StackMaster', cls: 'n-m', act: 'Check' },
          { name: 'BluffZilla', cls: 'n-c', act: 'Check' },
          { name: 'NeonRider', cls: 'n-c', act: 'Check' },
          { name: 'CyberKing', cls: 'n-h', act: 'Check' },
        ],
      },
    ],
    chatMessages: [
      { who: 'StackMaster', cls: 'n-m', msg: 'Nice hand!' },
      { who: 'BluffZilla', cls: 'n-c', msg: 'Thanks! GL all' },
      { who: 'CyberKing', cls: 'n-c', msg: "Let's goooo 🔥" },
      { who: 'NeonRider', cls: 'n-c', msg: '😎 😎' },
      { who: 'LunaLove', cls: 'n-p', msg: 'Good luck everyone!' },
    ],
    gameInfo: {
      gameType: "No Limit Hold'em",
      stakes: '$1 / $2',
      buyIn: '$200 (100 BB)',
      playerCount: count,
      maxSeats: 9,
      nextBreak: '00:45:21',
    },
    actionBar: {
      potAmount: 34.5,
      toCall: 10,
      minRaise: 20,
      maxRaise: 412.75,
      canCheck: false,
      raiseDisplayAmount: 34.5,
      sliderPct: 3.7,
      activeQuickId: 'min',
      actionsEnabled: true,
    },
    layout,
    playersBySeatIndex,
    seatStatesBySeatIndex,
    gameState,
  };
}

export const TABLE_PAGE_MOCK: TablePageMock = buildTablePageMock();
