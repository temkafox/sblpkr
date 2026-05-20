import type {
  PlayerGameState,
  RoomStatePayload,
  WireSeatView,
} from '@neonpoker/shared';

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
  /** `waiting` = room roster only; `hand` = active hand UI (board, badges, actions). */
  phase: 'waiting' | 'hand';
};

/** Seat index sentinel — no D/SB/BB/active badges render in waiting phase. */
export const NO_HAND_SEAT_INDEX = -1;

export function isActiveHand(
  state: PlayerGameState | null | undefined,
): boolean {
  return state?.handId != null && state.handId.length > 0;
}

/** Viewer stack from authoritative game state (server seat index). */
export function viewerSeatStack(
  state: PlayerGameState | null | undefined,
  viewerSeatIndex: number | null,
): number | null {
  if (state == null || viewerSeatIndex == null) {
    return null;
  }
  const seat = state.seats.find((s) => s.seatIndex === viewerSeatIndex);
  return seat?.playerId != null ? seat.stack : null;
}

/** Seated players eligible for the next hand (stack > 0, not sitting out). */
export function countSeatsWithChips(
  state: PlayerGameState | null | undefined,
): number {
  if (state == null) {
    return 0;
  }
  return state.seats.filter(
    (seat) =>
      seat.playerId != null && seat.stack > 0 && !seat.isSittingOut,
  ).length;
}

/** True when a seat view represents a player who can start the next hand. */
export function isSeatEligibleForNextHand(seat: WireSeatView): boolean {
  return seat.playerId != null && seat.stack > 0 && !seat.isSittingOut;
}

/**
 * True when idle game state includes an explicit zero stack for a roster player
 * (post-bust), as opposed to a missing/partial runtime entry before first hand.
 */
export function hasExplicitBustedStackInIdleState(
  state: PlayerGameState,
  room: RoomStatePayload,
): boolean {
  if (isActiveHand(state)) {
    return true;
  }
  const rosterIds = new Set(room.players.map((p) => p.playerId));
  for (const seat of state.seats) {
    if (seat.playerId == null || !rosterIds.has(seat.playerId)) {
      continue;
    }
    if (seat.stack <= 0) {
      return true;
    }
  }
  return false;
}

/**
 * Eligible players for starting the next hand.
 * Pre-first-hand lobby assumes joined players have {@link LOBBY_PLACEHOLDER_STACK}
 * until the server reports an explicit bust (stack <= 0).
 */
export function countEligibleForNextHand(
  gameState: PlayerGameState | null | undefined,
  room: RoomStatePayload | null,
): number {
  const playerCount = room?.players.length ?? 0;
  if (gameState == null || room == null) {
    return playerCount;
  }
  if (
    isActiveHand(gameState) ||
    hasExplicitBustedStackInIdleState(gameState, room)
  ) {
    return countSeatsWithChips(gameState);
  }
  return playerCount;
}

function preHandMockGameState(preset: SeatCount): MockGameState {
  return {
    seats: preset,
    dealerSeatIndex: NO_HAND_SEAT_INDEX,
    smallBlindSeatIndex: NO_HAND_SEAT_INDEX,
    bigBlindSeatIndex: NO_HAND_SEAT_INDEX,
    activeSeatIndex: NO_HAND_SEAT_INDEX,
  };
}

function stacksByPlayerId(
  state: PlayerGameState | null | undefined,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  if (state == null) return map;
  for (const seat of state.seats) {
    if (seat.playerId != null) {
      map.set(seat.playerId, seat.stack);
    }
  }
  return map;
}

const LOBBY_PLACEHOLDER_STACK = 200;

const RINGS: readonly PlayerRing[] = [
  'cyan',
  'pink',
  'magenta',
  'violet',
  'green',
  'amber',
];

/** Layout preset bucket from occupied (seated) player count. */
export function occupiedCountToLayoutPreset(occupiedCount: number): SeatCount {
  if (occupiedCount <= 2) return 2;
  if (occupiedCount <= 4) return 4;
  if (occupiedCount <= 6) return 6;
  return 9;
}

/** @deprecated Use {@link occupiedCountToLayoutPreset} for live server state. */
export function toSeatCount(maxSeats: number): SeatCount {
  return occupiedCountToLayoutPreset(maxSeats);
}

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

export function resolveSeatNickname(
  seat: Pick<WireSeatView, 'playerId' | 'nickname'>,
  room: RoomStatePayload | null,
): string | null {
  const wire = seat.nickname?.trim();
  if (wire) return wire;
  if (seat.playerId == null || room == null) return null;
  const member = room.players.find((p) => p.playerId === seat.playerId);
  if (member?.nickname?.trim()) return member.nickname.trim();
  return null;
}

export function orderRoomPlayersForViewer<
  T extends { playerId: string; nickname: string },
>(players: readonly T[], viewerNickname: string | null): T[] {
  if (players.length === 0) return [];

  const nick = viewerNickname?.trim().toLowerCase();
  let viewerIdx = 0;
  if (nick) {
    const found = players.findIndex(
      (p) => p.nickname.trim().toLowerCase() === nick,
    );
    if (found >= 0) viewerIdx = found;
  }

  const viewer = players[viewerIdx]!;
  const others = players
    .filter((_, i) => i !== viewerIdx)
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  return [viewer, ...others];
}

/**
 * Resolves the viewer's server seat index — never inferred from hole cards.
 * Prefer explicit `viewerSeatIndex` from the server payload.
 */
export function resolveViewerServerSeatIndex(
  state: PlayerGameState,
  viewerNickname: string | null,
): number {
  const explicit = state.viewerSeatIndex;
  if (Number.isInteger(explicit) && explicit >= 0) {
    const byServer = state.seats.some((s) => s.seatIndex === explicit);
    if (byServer) {
      return explicit;
    }
  }

  if (viewerNickname) {
    const nick = viewerNickname.trim().toLowerCase();
    const byNick = state.seats.find(
      (s) => s.nickname?.trim().toLowerCase() === nick,
    );
    if (byNick != null) {
      return byNick.seatIndex;
    }
  }

  const firstOccupied = state.seats.find((s) => s.playerId != null);
  return firstOccupied?.seatIndex ?? 0;
}

/** @deprecated Use {@link resolveViewerServerSeatIndex}. */
export function findViewerSeatIndex(
  state: PlayerGameState,
  viewerNickname: string | null,
): number {
  return resolveViewerServerSeatIndex(state, viewerNickname);
}

/** Viewer first, then other occupied seats in server seat order. */
export function orderOccupiedSeatsForViewer(
  seats: readonly WireSeatView[],
  viewerServerSeatIndex: number,
): WireSeatView[] {
  const occupied = seats.filter((s) => s.playerId != null);
  const viewer = occupied.find((s) => s.seatIndex === viewerServerSeatIndex);
  if (viewer == null) {
    return [...occupied].sort((a, b) => a.seatIndex - b.seatIndex);
  }
  const others = occupied
    .filter((s) => s.seatIndex !== viewer.seatIndex)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  return [viewer, ...others];
}

export function remapServerSeatToLayout(
  serverIdx: number | null,
  serverToLayout: ReadonlyMap<number, number>,
): number {
  if (serverIdx == null) return 0;
  return serverToLayout.get(serverIdx) ?? 0;
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

function seatLabelBet(seat: WireSeatView): number {
  const amount = seat.lastAction?.amount;
  if (amount != null && amount > 0) {
    return amount;
  }
  return seat.currentBet;
}

function seatIsWinner(
  seat: WireSeatView,
  winnerSeatIndexes: readonly number[] | undefined,
): boolean {
  if (seat.isWinner === true) {
    return true;
  }
  return (
    winnerSeatIndexes != null &&
    winnerSeatIndexes.includes(seat.seatIndex)
  );
}

/** Maps wire seat + hand context to HUD status token (Phase 7H priority). */
export function resolveSeatStatus(
  seat: WireSeatView,
  activeSeatIndex: number | null,
  handComplete: boolean,
  hasActiveHand: boolean,
  winnerSeatIndexes?: readonly number[],
): SeatStateMock['status'] {
  if (handComplete && seatIsWinner(seat, winnerSeatIndexes)) {
    return 'winner';
  }
  if (seat.connectionStatus === 'disconnected') {
    return 'away';
  }
  if (hasActiveHand && !handComplete && activeSeatIndex === seat.seatIndex) {
    return 'turn';
  }
  if (seat.hasFolded) {
    return 'fold';
  }
  if (
    hasActiveHand &&
    !handComplete &&
    (seat.isAllIn ||
      (seat.stack <= 0 && (seat.holeCardCount ?? 0) > 0))
  ) {
    return 'allin';
  }

  if (hasActiveHand && !handComplete) {
    const kind = seat.lastAction?.kind;
    if (kind === 'raise') return 'raise';
    if (kind === 'call') return 'call';
    if (kind === 'check') return 'check';
    if (kind === 'allin') return 'allin';
    if (kind === 'fold') return 'fold';
    if (kind === 'post_sb') return 'post_sb';
    if (kind === 'post_bb') return 'post_bb';
  }

  if (handComplete) {
    if (seat.isSittingOut) return 'sitout';
    if (seat.stack <= 0) return 'busted';
    return 'idle';
  }
  if (!hasActiveHand) {
    if (seat.isSittingOut) return 'sitout';
    if (seat.stack <= 0) return 'busted';
    return 'waiting';
  }
  if (seat.isSittingOut || seat.stack <= 0) return 'sitout';
  return 'idle';
}

function boardRevealForState(state: PlayerGameState): BoardReveal {
  if (state.handComplete && state.handEndKind === 'SHOWDOWN') {
    return 5;
  }
  if (state.handComplete && state.boardCards.length >= 5) {
    return 5;
  }
  return boardRevealFromStreet(state.street);
}

function padBoard(cards: readonly CardModel[]): CardModel[] {
  const out: CardModel[] = [...cards];
  while (out.length < 5) {
    out.push({ r: '2', s: 'c' });
  }
  return out.slice(0, 5);
}

function idleActionBar(potAmount = 0): ActionBarMock {
  return {
    potAmount,
    toCall: 0,
    minRaise: 0,
    maxRaise: 0,
    canCheck: false,
    raiseDisplayAmount: 0,
    sliderPct: 0,
    activeQuickId: null,
    actionsEnabled: false,
  };
}

function baseLiveGameInfo(
  playerCount: number,
  maxSeats: number,
): TablePageMock['gameInfo'] {
  return {
    gameType: "No Limit Hold'em",
    stakes: 'MVP',
    buyIn: '—',
    playerCount,
    maxSeats,
    nextBreak: '—',
  };
}

/** Empty table shell while live room connects (no demo mock). */
export function createWaitingLiveTableView(): AdaptedTableView {
  return {
    phase: 'waiting',
    potAmount: 0,
    showPotChips: false,
    boardCards: [],
    boardReveal: 0,
    heroHoleCards: null,
    handHistory: [],
    chatMessages: [],
    gameInfo: baseLiveGameInfo(0, 9),
    actionBar: idleActionBar(),
    layout: [],
    playersBySeatIndex: [],
    seatStatesBySeatIndex: [],
    gameState: preHandMockGameState(2),
  };
}

/** Pre-hand lobby from SERVER_ROOM_STATE — real nicknames, no board/hand. */
export function adaptRoomLobbyState(
  room: RoomStatePayload,
  viewerNickname: string | null,
  idleTableState: PlayerGameState | null = null,
): AdaptedTableView {
  const ordered = orderRoomPlayersForViewer(room.players, viewerNickname);
  const occupiedCount = ordered.length;
  const preset = occupiedCountToLayoutPreset(occupiedCount);
  const layout = LAYOUTS[preset].slice(0, occupiedCount);
  const stacks = stacksByPlayerId(idleTableState);

  const playersBySeatIndex: PlayerMock[] = ordered.map((member, layoutIdx) => ({
    id: member.playerId,
    name: member.nickname,
    stack: stacks.has(member.playerId)
      ? stacks.get(member.playerId)!
      : LOBBY_PLACEHOLDER_STACK,
    ring: RINGS[layoutIdx % RINGS.length]!,
    init: member.nickname.slice(0, 2).toUpperCase(),
    avatar: layoutIdx === 0 ? '/assets/avatar-1.png' : null,
  }));

  const seatStatesBySeatIndex: SeatStateMock[] = ordered.map((member) => ({
    status: member.connectionStatus === 'disconnected' ? 'away' : 'waiting',
    bet: 0,
    amount: '',
    showOppBackcards: false,
  }));

  return {
    phase: 'waiting',
    potAmount: 0,
    showPotChips: false,
    boardCards: [],
    boardReveal: 0,
    heroHoleCards: null,
    handHistory: [],
    chatMessages: [],
    gameInfo: baseLiveGameInfo(occupiedCount, room.maxSeats),
    actionBar: idleActionBar(),
    layout,
    playersBySeatIndex,
    seatStatesBySeatIndex,
    gameState: preHandMockGameState(preset),
  };
}

function buildActionBar(
  state: PlayerGameState,
  viewerServerSeatIndex: number,
): ActionBarMock {
  const actions = state.availableActions;
  const isViewerTurn =
    actions != null && state.activeSeatIndex === viewerServerSeatIndex;

  return {
    potAmount: state.pot.total,
    toCall: actions?.callAmount ?? 0,
    minRaise: actions?.minRaise ?? 0,
    maxRaise: actions?.maxRaise ?? 0,
    canCheck: actions?.canCheck ?? false,
    raiseDisplayAmount: actions?.minRaise ?? 0,
    sliderPct: 0,
    activeQuickId: null,
    actionsEnabled: isViewerTurn,
  };
}

export function adaptPlayerGameState(
  state: PlayerGameState,
  viewerNickname: string | null,
  room: RoomStatePayload | null = null,
): AdaptedTableView {
  const viewerServerSeatIndex = resolveViewerServerSeatIndex(
    state,
    viewerNickname,
  );
  const ordered = orderOccupiedSeatsForViewer(
    state.seats,
    viewerServerSeatIndex,
  );
  const occupiedCount = ordered.length;
  const preset = occupiedCountToLayoutPreset(occupiedCount);
  const layout = LAYOUTS[preset].slice(0, occupiedCount);

  const serverToLayout = new Map<number, number>();
  ordered.forEach((seat, layoutIdx) => {
    serverToLayout.set(seat.seatIndex, layoutIdx);
  });

  const playersBySeatIndex: PlayerMock[] = ordered.map((seat, layoutIdx) => {
    const name =
      resolveSeatNickname(seat, room) ?? (room == null ? 'Player' : '');
    return {
      id: seat.playerId!,
      name,
      stack: seat.stack,
      ring: RINGS[layoutIdx % RINGS.length]!,
      init: (name || '?').slice(0, 2).toUpperCase(),
      avatar: layoutIdx === 0 ? '/assets/avatar-1.png' : null,
    };
  });

  const seatStatesBySeatIndex: SeatStateMock[] = ordered.map((seat, layoutIdx) => {
    const revealed =
      layoutIdx !== 0 && seat.holeCards != null && seat.holeCards.length >= 2
        ? [seat.holeCards[0]!, seat.holeCards[1]!]
        : null;
    return {
      status: resolveSeatStatus(
        seat,
        state.activeSeatIndex,
        state.handComplete,
        true,
        state.winnerSeatIndexes,
      ),
      bet: seatLabelBet(seat),
      amount: seatLabelBet(seat) > 0 ? seatLabelBet(seat) : '',
      showOppBackcards: shouldShowOppBackcards(seat, layoutIdx),
      oppHoleCards: revealed,
    };
  });

  const heroSeat = ordered[0];
  const heroHoleCards: [CardModel, CardModel] | null =
    heroSeat?.holeCards?.length === 2
      ? [heroSeat.holeCards[0]!, heroSeat.holeCards[1]!]
      : null;

  const gameState: MockGameState = {
    seats: preset,
    dealerSeatIndex: remapServerSeatToLayout(
      state.dealerSeatIndex,
      serverToLayout,
    ),
    smallBlindSeatIndex: remapServerSeatToLayout(
      state.smallBlindSeatIndex,
      serverToLayout,
    ),
    bigBlindSeatIndex: remapServerSeatToLayout(
      state.bigBlindSeatIndex,
      serverToLayout,
    ),
    activeSeatIndex: remapServerSeatToLayout(
      state.activeSeatIndex,
      serverToLayout,
    ),
  };

  return {
    phase: 'hand',
    potAmount: state.pot.total,
    showPotChips: state.pot.total > 0,
    boardCards: padBoard(state.boardCards),
    boardReveal: boardRevealForState(state),
    heroHoleCards,
    handHistory: [],
    chatMessages: [],
    gameInfo: baseLiveGameInfo(occupiedCount, state.maxSeats),
    actionBar: buildActionBar(state, viewerServerSeatIndex),
    layout,
    playersBySeatIndex,
    seatStatesBySeatIndex,
    gameState,
  };
}
