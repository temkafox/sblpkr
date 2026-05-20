/**
 * Phase 1B visual mocks — typed fixtures derived from /design/data.jsx.
 * Not authoritative game state; replaced when shared contracts land.
 */

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
  /** Static raise label / input display */
  raiseDisplayAmount: number;
  /** Slider fill width % (visual only) */
  sliderPct: number;
  /** Quick-bet pill highlight id (visual only) */
  activeQuickId: 'min' | 'half' | 'pot' | '2x' | 'all' | null;
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
}

export const TABLE_PAGE_MOCK: TablePageMock = {
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
    playerCount: 9,
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
  },
};
