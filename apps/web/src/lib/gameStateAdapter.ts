import type { PlayerGameState, WireSeatView } from '@neonpoker/shared';

import { LAYOUTS, type SeatCount } from './layout';
import type {
  ActionBarMock,
  BoardReveal,
  CardModel,
  MockGameState,
  PlayerMock,
  PlayerRing,
  SeatStateMock,
  TablePageMock,
} from '../mocks/tableMock';

/** Table view derived from server PlayerGameState (viewer always at layout seat 0). */
export type AdaptedTableView = Omit<TablePageMock, 'heroHoleCards'> & {
  heroHoleCards: [CardModel, CardModel] | null;
};

const RINGS: readonly PlayerRing[] = [
  'cyan',
  'pink',
  'magenta',
  'violet',
  'green',
  'amber',
];

const EMPTY_PLAYER: PlayerMock = {
  id: '__empty__',
  name: '',
  stack: 0,
  ring: 'violet',
  init: '',
  avatar: null,
};

export function boardRevealFromStreet(
  street: PlayerGameState['street'],
): BoardReveal {
  if (street == null) return 0;
  switch (street) {
    case 'PRE-FLOP':
      return 0;
    case 'FLOP':
      return 3;
    case 'TURN':
      return 4;
    case 'RIVER':
    case 'SHOWDOWN':
      return 5;
    default:
      return 0;
  }
}

export function toSeatCount(maxSeats: number): SeatCount {
  if (maxSeats === 2 || maxSeats === 4 || maxSeats === 6 || maxSeats === 9) {
    return maxSeats;
  }
  if (maxSeats <= 2) return 2;
  if (maxSeats <= 4) return 4;
  if (maxSeats <= 6) return 6;
  return 9;
}

export function findViewerSeatIndex(
  state: PlayerGameState,
  viewerNickname: string | null,
): number {
  const withCards = state.seats.findIndex(
    (s) => s.holeCards != null && s.holeCards.length > 0,
  );
  if (withCards >= 0) return withCards;

  if (viewerNickname) {
    const nick = viewerNickname.trim().toLowerCase();
    const byNick = state.seats.findIndex(
      (s) => s.nickname?.trim().toLowerCase() === nick,
    );
    if (byNick >= 0) return byNick;
  }

  const occupied = state.seats.findIndex((s) => s.playerId != null);
  return occupied >= 0 ? occupied : 0;
}

function rotate<T>(items: readonly T[], pivot: number): T[] {
  const n = items.length;
  return Array.from({ length: n }, (_, layoutIdx) => items[(pivot + layoutIdx) % n]!);
}

export function remapSeatIndex(
  serverIdx: number | null,
  pivot: number,
  seatCount: number,
): number {
  if (serverIdx == null) return 0;
  return (serverIdx - pivot + seatCount) % seatCount;
}

export function shouldShowOppBackcards(
  seat: WireSeatView,
  layoutIdx: number,
): boolean {
  if (layoutIdx === 0) return false;
  const count = seat.holeCardCount ?? 0;
  if (count <= 0) return false;
  return seat.holeCards == null || seat.holeCards.length === 0;
}

function seatStatus(
  seat: WireSeatView,
  activeSeatIndex: number | null,
  serverSeatIndex: number,
): SeatStateMock['status'] {
  if (seat.playerId == null || seat.isSittingOut) return 'sitout';
  if (seat.hasFolded) return 'fold';
  if (seat.isAllIn) return 'allin';
  if (activeSeatIndex === serverSeatIndex) return 'turn';
  return 'idle';
}

function padBoard(cards: readonly CardModel[]): CardModel[] {
  const out: CardModel[] = [...cards];
  while (out.length < 5) {
    out.push({ r: '2', s: 'c' });
  }
  return out.slice(0, 5);
}

function buildActionBar(state: PlayerGameState): ActionBarMock {
  const actions = state.availableActions;
  return {
    potAmount: state.pot.total,
    toCall: actions?.callAmount ?? 0,
    minRaise: actions?.minRaise ?? 0,
    maxRaise: actions?.maxRaise ?? 0,
    canCheck: actions?.canCheck ?? false,
    raiseDisplayAmount: actions?.minRaise ?? 0,
    sliderPct: 0,
    activeQuickId: null,
  };
}

export function adaptPlayerGameState(
  state: PlayerGameState,
  viewerNickname: string | null,
): AdaptedTableView {
  const seatCount = toSeatCount(state.maxSeats);
  const layout = LAYOUTS[seatCount];
  const pivot = findViewerSeatIndex(state, viewerNickname);
  const n = state.seats.length;

  const rotatedSeats = rotate(state.seats, pivot);

  const playersBySeatIndex: PlayerMock[] = rotatedSeats.map((seat, layoutIdx) => {
    if (seat.playerId == null) {
      return { ...EMPTY_PLAYER, id: `empty-${layoutIdx}` };
    }
    return {
      id: seat.playerId,
      name: seat.nickname ?? 'Player',
      stack: seat.stack,
      ring: RINGS[layoutIdx % RINGS.length]!,
      init: (seat.nickname ?? '?').slice(0, 2).toUpperCase(),
      avatar: layoutIdx === 0 ? '/assets/avatar-1.png' : null,
    };
  });

  const seatStatesBySeatIndex: SeatStateMock[] = rotatedSeats.map((seat, layoutIdx) => {
    const serverIdx = (pivot + layoutIdx) % n;
    const status = seatStatus(seat, state.activeSeatIndex, serverIdx);
    return {
      status,
      bet: seat.currentBet,
      amount: seat.currentBet > 0 ? seat.currentBet : '',
      showOppBackcards: shouldShowOppBackcards(seat, layoutIdx),
    };
  });

  const heroSeat = rotatedSeats[0];
  const heroHoleCards: [CardModel, CardModel] | null =
    heroSeat?.holeCards?.length === 2
      ? [heroSeat.holeCards[0]!, heroSeat.holeCards[1]!]
      : null;

  const gameState: MockGameState = {
    seats: seatCount,
    dealerSeatIndex: remapSeatIndex(state.dealerSeatIndex, pivot, n),
    smallBlindSeatIndex: remapSeatIndex(state.smallBlindSeatIndex, pivot, n),
    bigBlindSeatIndex: remapSeatIndex(state.bigBlindSeatIndex, pivot, n),
    activeSeatIndex: remapSeatIndex(state.activeSeatIndex, pivot, n),
  };

  return {
    potAmount: state.pot.total,
    showPotChips: state.pot.total > 0,
    boardCards: padBoard(state.boardCards),
    boardReveal: boardRevealFromStreet(state.street),
    heroHoleCards,
    handHistory: [],
    chatMessages: [],
    gameInfo: {
      gameType: "No Limit Hold'em",
      stakes: 'MVP',
      buyIn: '—',
      playerCount: state.seats.filter((s) => s.playerId != null).length,
      maxSeats: state.maxSeats,
      nextBreak: '—',
    },
    actionBar: buildActionBar(state),
    layout,
    playersBySeatIndex,
    seatStatesBySeatIndex,
    gameState,
  };
}
