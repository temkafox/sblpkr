import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import { TABLE_PAGE_MOCK } from '../../mocks/tableMock';
import * as socket from '../../net/socket';
import { TablePage } from './TablePage';
import { useChatStore } from '../../state/chatStore';
import { useGameStore } from '../../state/gameStore';
import { useRoomStore } from '../../state/roomStore';
import { useSessionStore } from '../../state/sessionStore';
import { chatRowsFromMessages } from '../../lib/chatAdapter';
import { mockRoomState } from '../../test/roomFixtures';

vi.mock('../../net/socket', () => ({
  requestGameState: vi.fn(),
  requestHandHistory: vi.fn(),
  requestChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  startHand: vi.fn(),
  setNextHandReady: vi.fn(),
  rebuy: vi.fn(),
  sendPlayerAction: vi.fn(),
  onGameState: vi.fn(() => () => {}),
  onHandResult: vi.fn(() => () => {}),
}));

const roomId = '11111111-1111-4111-8111-111111111111';

const soloRoom: RoomStatePayload = mockRoomState({
  roomId,
  players: [
    { playerId: 'a', nickname: 'ljhh', seatIndex: 0, connectionStatus: 'connected' },
  ],
});

const duoRoom: RoomStatePayload = mockRoomState({
  roomId,
  players: [
    { playerId: 'a', nickname: 'ljhh', seatIndex: 0, connectionStatus: 'connected' },
    { playerId: 'b', nickname: 'ASD', seatIndex: 1, connectionStatus: 'connected' },
  ],
});

const trioRoom: RoomStatePayload = mockRoomState({
  roomId,
  players: [
    { playerId: 'a', nickname: 'PlayerA', seatIndex: 0, connectionStatus: 'connected' },
    { playerId: 'b', nickname: 'PlayerB', seatIndex: 1, connectionStatus: 'connected' },
    { playerId: 'c', nickname: 'PlayerC', seatIndex: 2, connectionStatus: 'connected' },
  ],
});

const idlePreHandState: PlayerGameState = {
  tableId: roomId,
  maxSeats: 9,
  viewerSeatIndex: 0,
  street: null,
  boardCards: [],
  pot: { total: 0, sidePots: [] },
  dealerSeatIndex: 0,
  smallBlindSeatIndex: 0,
  bigBlindSeatIndex: 1,
  activeSeatIndex: 0,
  handId: null,
  handComplete: false,
  showdownReady: false,
  seats: [
    {
      seatIndex: 0,
      playerId: 'a',
      nickname: 'ljhh',
      stack: 200,
      currentBet: 0,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: null,
      holeCardCount: null,
    },
    {
      seatIndex: 1,
      playerId: 'b',
      nickname: 'ASD',
      stack: 200,
      currentBet: 0,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: null,
      holeCardCount: null,
    },
  ],
};

const idleThreeWay: PlayerGameState = {
  ...idlePreHandState,
  viewerSeatIndex: 0,
  seats: [
    {
      ...idlePreHandState.seats[0]!,
      seatIndex: 0,
      playerId: 'a',
      nickname: 'PlayerA',
      stack: 600,
    },
    {
      ...idlePreHandState.seats[1]!,
      seatIndex: 1,
      playerId: 'b',
      nickname: 'PlayerB',
      stack: 200,
    },
    {
      seatIndex: 2,
      playerId: 'c',
      nickname: 'PlayerC',
      stack: 0,
      currentBet: 0,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: true,
      holeCards: null,
      holeCardCount: null,
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      seatIndex: i + 3,
      playerId: null,
      nickname: null,
      stack: 0,
      currentBet: 0,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: null,
      holeCardCount: null,
    })),
  ],
};

const liveState: PlayerGameState = {
  ...idlePreHandState,
  street: 'PRE-FLOP',
  pot: { total: 3, sidePots: [] },
  handId: 'hand-1',
  activeSeatIndex: 0,
  availableActions: {
    canFold: true,
    canCheck: false,
    canCall: true,
    callAmount: 1,
    canRaise: true,
    minRaise: 4,
    maxRaise: 200,
    canAllIn: true,
  },
  seats: [
    {
      ...idlePreHandState.seats[0]!,
      currentBet: 1,
      holeCards: [
        { r: '2', s: 'h' },
        { r: '3', s: 'h' },
      ],
      holeCardCount: 2,
    },
    {
      ...idlePreHandState.seats[1]!,
      currentBet: 2,
      holeCardCount: 2,
    },
  ],
};

function heroRebuyButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector('.seat.hero .seat-rebuy-btn');
}

function renderTable() {
  return render(
    <MemoryRouter initialEntries={[`/table/${roomId}`]}>
      <Routes>
        <Route path="/table/:roomId" element={<TablePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TablePage live room', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().clearGameState();
    useChatStore.getState().clearChatMessages();
    useRoomStore.setState({ roomState: null, lastError: null });
    useSessionStore.setState({
      nickname: 'ljhh',
      roomId,
      connectionStatus: 'connected',
    });
  });

  it('requests game state and hand history on mount', () => {
    renderTable();
    expect(socket.requestGameState).toHaveBeenCalledWith(roomId);
    expect(socket.requestHandHistory).toHaveBeenCalledWith(roomId);
  });

  it('requests chat snapshot when socket is connected and room is joined', () => {
    useRoomStore.getState().setRoomState(soloRoom);
    renderTable();
    expect(socket.requestChatMessages).toHaveBeenCalledWith(roomId);
  });

  it('renders hydrated chat after snapshot without sending a message', async () => {
    useRoomStore.getState().setRoomState(duoRoom);
    renderTable();
    useChatStore.getState().setChatMessages([
      {
        id: 'm1',
        roomId,
        playerId: 'a',
        nickname: 'ljhh',
        text: 'old line',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await waitFor(() => {
      expect(screen.getByText('old line')).toBeInTheDocument();
      expect(screen.getByText('ljhh:')).toBeInTheDocument();
    });
  });

  it('uses stable chat color for repeated messages from one player', () => {
    const rows = chatRowsFromMessages([
      {
        id: 'm1',
        roomId,
        playerId: 'a',
        nickname: 'd32f',
        text: 'one',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'm2',
        roomId,
        playerId: 'a',
        nickname: 'd32f',
        text: 'two',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
      },
    ]);
    expect(rows[0]!.cls).toBe(rows[1]!.cls);
    expect(rows[0]!.cls).not.toMatch(/^n-/);
  });

  it('pre-hand with one player hides board, badges, and Start Hand', () => {
    useRoomStore.getState().setRoomState(soloRoom);
    useGameStore.getState().setGameState(idlePreHandState);

    const { container } = renderTable();

    expect(screen.getByText('ljhh')).toBeInTheDocument();
    expect(container.querySelector('.np-board')).toBeNull();
    expect(container.querySelector('.seat-badge')).toBeNull();
    expect(screen.queryByText(/your turn/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start hand/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/waiting for another player/i),
    ).toBeInTheDocument();
    expect(container.querySelector('.np-action-bar')).toBeNull();
    expect(container.querySelector('.np-pot-amt')?.textContent).toBe('$0');
  });

  it('idle gameState without handId does not render demo mock names', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState(idlePreHandState);
    renderTable();
    expect(screen.getByText('ljhh')).toBeInTheDocument();
    expect(screen.getByText('ASD')).toBeInTheDocument();
    expect(screen.queryByText('NeonRider')).not.toBeInTheDocument();
    expect(screen.queryByText('CyberKing')).not.toBeInTheDocument();
  });

  it('does not show demo pot while loading in live room', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameLoading(true);
    renderTable();
    expect(
      screen.queryByText(`$${TABLE_PAGE_MOCK.potAmount}`),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/loading game state/i)).not.toBeInTheDocument();
    expect(document.querySelector('.np-board')).toBeNull();
  });

  it('clears loading display when room arrives without gameState', () => {
    useGameStore.getState().setGameLoading(true);
    useRoomStore.getState().setRoomState(soloRoom);
    renderTable();
    expect(screen.queryByText(/loading game state/i)).not.toBeInTheDocument();
    expect(screen.getByText('ljhh')).toBeInTheDocument();
  });

  it('pre-hand lobby shows both players at $200 without waiting-for-rebuy', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...idlePreHandState,
      seats: [
        { ...idlePreHandState.seats[0]!, stack: 200 },
        ...idlePreHandState.seats.slice(1),
      ],
    });
    const { container } = renderTable();
    expect(container.textContent).toMatch(/\$200/);
    expect(
      screen.getByRole('button', { name: /^start hand$/i }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.table-page__status')?.textContent ?? '',
    ).not.toMatch(/not enough players with chips/i);
  });

  it('shows Start Hand only with two players and no active hand', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    renderTable();
    expect(screen.getByRole('button', { name: /start hand/i })).toBeInTheDocument();
  });

  it('renders live pot and board when hand is active', () => {
    useGameStore.getState().setGameState(liveState);
    useRoomStore.getState().setRoomState(duoRoom);
    const { container } = renderTable();
    expect(container.querySelector('.np-pot-amt')?.textContent).toBe('$3');
    expect(container.querySelector('.np-board')).not.toBeNull();
    expect(container.querySelector('.np-action-bar')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /start hand/i })).not.toBeInTheDocument();
  });

  it('does not show connection issue banner when game state is present', () => {
    useSessionStore.setState({
      nickname: 'ljhh',
      roomId,
      connectionStatus: 'error',
    });
    useGameStore.getState().setGameState(liveState);
    renderTable();
    expect(screen.queryByText(/connection issue/i)).not.toBeInTheDocument();
  });

  it('renders disabled ActionBar when viewer is not active during a hand', () => {
    useGameStore.getState().setGameState({
      ...liveState,
      activeSeatIndex: 1,
      availableActions: undefined,
    });
    const { container } = renderTable();
    expect(container.querySelector('.np-action-bar--disabled')).not.toBeNull();
  });

  it('same session nickname uses solo roster without inventing second seat', () => {
    useRoomStore.getState().setRoomState(soloRoom);
    useSessionStore.setState({
      nickname: 'ljhh',
      roomId,
      connectionStatus: 'connected',
    });
    renderTable();
    expect(screen.getAllByText('ljhh')).toHaveLength(1);
    expect(screen.queryByText('ASD')).not.toBeInTheDocument();
  });

  it('Start Hand emits startHand when eligible', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /start hand/i }));
    expect(socket.startHand).toHaveBeenCalledWith(roomId);
  });

  it('room meta shows WAITING before a hand starts', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    renderTable();
    expect(screen.getByText(/ABC123 · 2\/9 · WAITING · waiting for hand/i)).toBeInTheDocument();
  });

  it('room meta shows PRE-FLOP during an active hand', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState(liveState);
    renderTable();
    expect(screen.getByText(/ABC123 · 2\/9 · PRE-FLOP/i)).toBeInTheDocument();
    expect(screen.queryByText(/waiting for hand/i)).not.toBeInTheDocument();
  });

  it('stale active hand with one player shows waiting table, not board', () => {
    useRoomStore.getState().setRoomState(soloRoom);
    useGameStore.getState().setGameState(liveState);
    const { container } = renderTable();
    expect(container.querySelector('.np-board')).toBeNull();
    expect(container.querySelector('.seat-badge')).toBeNull();
    expect(screen.getByText(/ABC123 · 1\/9 · WAITING/i)).toBeInTheDocument();
    expect(screen.getByText('ljhh')).toBeInTheDocument();
    expect(screen.queryByText('Player')).not.toBeInTheDocument();
  });

  it('sends fold through socket API when viewer is active', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState(liveState);
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(socket.sendPlayerAction).toHaveBeenCalledWith(roomId, { kind: 'fold' });
  });

  it('sends check/call/raise/allin through socket API', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      availableActions: {
        canFold: true,
        canCheck: true,
        canCall: true,
        callAmount: 1,
        canRaise: true,
        minRaise: 4,
        maxRaise: 200,
        canAllIn: true,
      },
    });
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(socket.sendPlayerAction).toHaveBeenCalledWith(roomId, { kind: 'check' });

    fireEvent.click(screen.getByRole('button', { name: /call/i }));
    expect(socket.sendPlayerAction).toHaveBeenCalledWith(roomId, { kind: 'call' });

    fireEvent.click(screen.getByRole('button', { name: /^raise to/i }));
    expect(socket.sendPlayerAction).toHaveBeenCalledWith(roomId, {
      kind: 'raise',
      amount: 4,
    });

    fireEvent.click(screen.getByRole('button', { name: /^all-in$/i }));
    expect(socket.sendPlayerAction).toHaveBeenCalledWith(roomId, { kind: 'allin' });
  });

  it('does not mutate gameState locally after action click', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState(liveState);
    const before = useGameStore.getState().gameState;
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(useGameStore.getState().gameState).toBe(before);
  });

  it('does not send action when viewer is not active', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      activeSeatIndex: 1,
      availableActions: undefined,
    });
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(socket.sendPlayerAction).not.toHaveBeenCalled();
  });

  it('surfaces SERVER_ERROR in action banner during hand', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState(liveState);
    useGameStore.getState().setGameError('Not your turn');
    renderTable();
    expect(screen.getByText('Not your turn')).toBeInTheDocument();
  });

  it('renders integer chip amounts without decimals during a hand', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      pot: { total: 76, sidePots: [] },
      seats: [
        { ...liveState.seats[0]!, stack: 238 },
        { ...liveState.seats[1]!, stack: 162 },
      ],
    });
    const { container } = renderTable();
    expect(container.querySelector('.np-pot-amt')?.textContent).toBe('$76');
    expect(container.textContent).not.toMatch(/\$\d+\.\d+/);
  });

  it('shows AWAY on disconnected opponent during active hand', () => {
    useRoomStore.getState().setRoomState({
      ...duoRoom,
      players: [
        { playerId: 'a', nickname: 'ljhh', seatIndex: 0, connectionStatus: 'connected' },
        { playerId: 'b', nickname: 'ASD', seatIndex: 1, connectionStatus: 'disconnected' },
      ],
    });
    useGameStore.getState().setGameState({
      ...liveState,
      activeSeatIndex: 1,
      seats: [
        { ...liveState.seats[0]! },
        {
          ...liveState.seats[1]!,
          connectionStatus: 'disconnected',
          lastAction: { kind: 'call', amount: 2 },
        },
      ],
    });
    const { container } = renderTable();
    const awayLabels = [...container.querySelectorAll('.status.t-away')].map(
      (el) => el.textContent,
    );
    expect(awayLabels.some((t) => t?.includes('AWAY'))).toBe(true);
    expect(container.querySelector('.status.t-turn')?.textContent).not.toBe(
      'YOUR TURN',
    );
  });

  it('shows WINNER on completed hand winner seat instead of last action label', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      handEndKind: 'SHOWDOWN',
      street: 'SHOWDOWN',
      activeSeatIndex: null,
      availableActions: undefined,
      winnerSeatIndexes: [0],
      seats: [
        {
          ...liveState.seats[0]!,
          isWinner: true,
          lastAction: { kind: 'raise', amount: 40 },
        },
        {
          ...liveState.seats[1]!,
          hasFolded: true,
          lastAction: { kind: 'call', amount: 10 },
        },
      ],
    });
    const { container } = renderTable();
    const heroStatus = container.querySelector('.seat.hero .status');
    expect(heroStatus?.textContent).toMatch(/WINNER/i);
    expect(heroStatus?.textContent).not.toMatch(/RAISE/i);
  });

  it('hides ActionBar after heads-up all-in call completes to SHOWDOWN', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      handEndKind: 'SHOWDOWN',
      street: 'SHOWDOWN',
      activeSeatIndex: null,
      availableActions: undefined,
      boardCards: [
        { r: '2', s: 'h' },
        { r: '3', s: 'd' },
        { r: '4', s: 'c' },
        { r: '5', s: 's' },
        { r: '6', s: 'h' },
      ],
      seats: [
        {
          ...liveState.seats[0]!,
          stack: 0,
          isAllIn: true,
          currentBet: 0,
          holeCards: [
            { r: 'A', s: 'h' },
            { r: 'K', s: 'h' },
          ],
        },
        {
          ...liveState.seats[1]!,
          stack: 298,
          isAllIn: false,
          currentBet: 0,
          holeCards: [
            { r: 'Q', s: 'c' },
            { r: 'J', s: 'c' },
          ],
        },
      ],
    });
    const { container } = renderTable();
    expect(container.querySelector('.table-page__room-meta')?.textContent).toMatch(
      /HAND COMPLETE · SHOWDOWN/i,
    );
    expect(container.querySelector('.np-action-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: /check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /raise/i })).not.toBeInTheDocument();
  });

  it('shows result banner after handResult and disables ActionBar when hand complete', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      handEndKind: 'FOLD_WIN',
      street: 'SHOWDOWN',
      activeSeatIndex: null,
      availableActions: undefined,
    });
    useGameStore.getState().setHandResult({
      handId: 'hand-1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 15 },
      totalAwarded: 15,
      isFoldWin: true,
    });
    const { container } = renderTable();
    expect(container.querySelector('.table-page__room-meta')?.textContent).toMatch(
      /HAND COMPLETE · FOLD WIN/i,
    );
    expect(screen.getByText('+$15')).toBeInTheDocument();
    expect(container.querySelector('.np-action-bar')).toBeNull();
  });

  it('does not show Rebuy during an active hand even when viewer has $0 all-in', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      viewerSeatIndex: 0,
      activeSeatIndex: 1,
      availableActions: {
        canFold: true,
        canCheck: false,
        canCall: true,
        callAmount: 198,
        canRaise: false,
        minRaise: 0,
        maxRaise: 0,
        canAllIn: true,
      },
      seats: [
        {
          ...liveState.seats[0]!,
          stack: 0,
          isAllIn: true,
          isSittingOut: false,
          currentBet: 200,
          holeCardCount: 2,
        },
        { ...liveState.seats[1]!, stack: 198, holeCardCount: 2 },
      ],
    });
    const { container } = renderTable();
    expect(screen.queryByRole('button', { name: /rebuy/i })).not.toBeInTheDocument();
    expect(container.querySelector('.status.t-allin')).not.toBeNull();
    expect(container.querySelector('.status.t-sitout')).toBeNull();
  });

  it('ActionBar can call when facing an all-in', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      activeSeatIndex: 1,
      viewerSeatIndex: 1,
      availableActions: {
        canFold: true,
        canCheck: false,
        canCall: true,
        callAmount: 198,
        canRaise: true,
        minRaise: 4,
        maxRaise: 198,
        canAllIn: true,
      },
      seats: [
        {
          ...liveState.seats[0]!,
          stack: 0,
          isAllIn: true,
          currentBet: 200,
          holeCardCount: 2,
        },
        { ...liveState.seats[1]!, stack: 198, currentBet: 2, holeCardCount: 2 },
      ],
    });
    renderTable();
    const callBtn = screen.getByRole('button', { name: /call/i });
    expect(callBtn).not.toBeDisabled();
    fireEvent.click(callBtn);
    expect(socket.sendPlayerAction).toHaveBeenCalledWith(roomId, { kind: 'call' });
  });

  it('shows Rebuy button only for busted viewer', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      handEndKind: 'FOLD_WIN',
      activeSeatIndex: null,
      viewerSeatIndex: 1,
      seats: [
        { ...liveState.seats[0]!, stack: 400 },
        {
          ...liveState.seats[1]!,
          stack: 0,
          isSittingOut: true,
          holeCards: null,
          holeCardCount: null,
        },
      ],
    });
    const { container } = renderTable();
    expect(heroRebuyButton(container)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^rebuy/i })).toBe(
      heroRebuyButton(container),
    );
  });

  it('does not show Rebuy for player with chips', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      viewerSeatIndex: 0,
    });
    renderTable();
    expect(screen.queryByRole('button', { name: /rebuy/i })).not.toBeInTheDocument();
  });

  it('Rebuy emits CLIENT_REBUY via socket', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      viewerSeatIndex: 1,
      seats: [
        liveState.seats[0]!,
        {
          ...liveState.seats[1]!,
          stack: 0,
          isSittingOut: true,
          holeCards: null,
          holeCardCount: null,
        },
      ],
    });
    const { container } = renderTable();
    fireEvent.click(heroRebuyButton(container)!);
    expect(socket.rebuy).toHaveBeenCalledWith(roomId);
  });

  it('surfaces rebuy errors when hand is not in progress', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      activeSeatIndex: null,
      viewerSeatIndex: 1,
      seats: [
        liveState.seats[0]!,
        {
          ...liveState.seats[1]!,
          stack: 0,
          isSittingOut: true,
          holeCards: null,
          holeCardCount: null,
        },
      ],
    });
    useGameStore.getState().setGameError('Rebuy is only available when out of chips');
    const { container } = renderTable();
    expect(
      container.querySelector('.table-page__rebuy-error')?.textContent,
    ).toMatch(/out of chips/i);
  });

  it('shows Start Hand after rebuy idle state with two eligible players', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...idlePreHandState,
      viewerSeatIndex: 1,
      seats: [
        { ...idlePreHandState.seats[0]!, stack: 400 },
        {
          ...idlePreHandState.seats[1]!,
          stack: 200,
          isSittingOut: false,
        },
      ],
    });
    const { container } = renderTable();
    expect(
      screen.getByRole('button', { name: /^start hand$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rebuy/i })).not.toBeInTheDocument();
    expect(
      container.querySelector('.table-page__status')?.textContent ?? '',
    ).not.toMatch(/not enough players with chips/i);
  });

  it('clears sitout styling after server restores viewer stack', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...idlePreHandState,
      viewerSeatIndex: 0,
      seats: [
        {
          ...idlePreHandState.seats[0]!,
          stack: 200,
          isSittingOut: false,
        },
        { ...idlePreHandState.seats[1]!, stack: 400 },
      ],
    });
    const { container } = renderTable();
    expect(container.querySelector('.seat.state-sitout')).toBeNull();
    expect(container.querySelector('.status.t-sitout')).toBeNull();
  });

  it('three-way idle: busted viewer sees Rebuy, stacked viewer sees Start Hand', () => {
    useRoomStore.getState().setRoomState(trioRoom);
    useGameStore.getState().setGameState({
      ...idleThreeWay,
      viewerSeatIndex: 2,
    });
    useSessionStore.setState({
      nickname: 'PlayerC',
      roomId,
      connectionStatus: 'connected',
    });
    const { container } = renderTable();
    expect(heroRebuyButton(container)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^start hand$/i }),
    ).not.toBeInTheDocument();
  });

  it('three-way idle: non-busted viewer sees Start Hand, not Rebuy', () => {
    useRoomStore.getState().setRoomState(trioRoom);
    useGameStore.getState().setGameState({
      ...idleThreeWay,
      viewerSeatIndex: 0,
    });
    useSessionStore.setState({
      nickname: 'PlayerA',
      roomId,
      connectionStatus: 'connected',
    });
    renderTable();
    expect(screen.getByRole('button', { name: /^start hand$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rebuy/i })).not.toBeInTheDocument();
  });

  it('late joiner during active hand shows NEXT HAND and no actions', () => {
    useRoomStore.getState().setRoomState(trioRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      viewerSeatIndex: 2,
      seats: [
        liveState.seats[0]!,
        liveState.seats[1]!,
        {
          seatIndex: 2,
          playerId: 'c',
          nickname: 'PlayerC',
          stack: 200,
          currentBet: 0,
          hasFolded: false,
          isAllIn: false,
          isSittingOut: true,
          holeCards: null,
          holeCardCount: null,
        },
      ],
    });
    useSessionStore.setState({
      nickname: 'PlayerC',
      roomId,
      connectionStatus: 'connected',
    });
    const { container } = renderTable();
    expect(container.textContent).toMatch(/NEXT HAND/i);
    expect(screen.queryByRole('button', { name: /^fold$/i })).not.toBeInTheDocument();
  });

  it('hides Start Hand and shows waiting-for-rebuy when one player is busted', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...idlePreHandState,
      seats: [
        { ...idlePreHandState.seats[0]!, stack: 400 },
        {
          ...idlePreHandState.seats[1]!,
          stack: 0,
          isSittingOut: true,
        },
      ],
    });
    const { container } = renderTable();
    expect(
      screen.queryByRole('button', { name: /^start hand$/i }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.table-page__status')?.textContent ?? '',
    ).toMatch(/not enough players with chips/i);
  });

  it('ready panel renders eligible players after hand completes', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      street: 'SHOWDOWN',
      activeSeatIndex: null,
    });
    useGameStore.getState().setNextHandReadyState({
      roomId,
      eligiblePlayers: [
        {
          playerId: 'a',
          nickname: 'ljhh',
          seatIndex: 0,
          isReady: false,
        },
        {
          playerId: 'b',
          nickname: 'ASD',
          seatIndex: 1,
          isReady: true,
        },
      ],
      readyCount: 1,
      requiredCount: 2,
    });
    renderTable();
    expect(screen.getByRole('heading', { name: /next hand/i })).toBeInTheDocument();
    const sidebar = document.querySelector('.np-sidebar');
    expect(sidebar?.textContent).toMatch(/ljhh/);
    expect(sidebar?.textContent).toMatch(/ASD/);
    expect(screen.queryByRole('button', { name: /start next hand/i })).not.toBeInTheDocument();
  });

  it('eligible viewer can click Ready for next hand', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      street: 'SHOWDOWN',
      activeSeatIndex: null,
    });
    useGameStore.getState().setNextHandReadyState({
      roomId,
      eligiblePlayers: [
        {
          playerId: 'a',
          nickname: 'ljhh',
          seatIndex: 0,
          isReady: false,
        },
        {
          playerId: 'b',
          nickname: 'ASD',
          seatIndex: 1,
          isReady: false,
        },
      ],
      readyCount: 0,
      requiredCount: 2,
    });
    renderTable();
    fireEvent.click(
      screen.getByRole('button', { name: /ready for next hand/i }),
    );
    expect(socket.setNextHandReady).toHaveBeenCalledWith(roomId);
  });

  it('ready button becomes waiting after viewer is ready', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      street: 'SHOWDOWN',
      activeSeatIndex: null,
    });
    useGameStore.getState().setNextHandReadyState({
      roomId,
      eligiblePlayers: [
        {
          playerId: 'a',
          nickname: 'ljhh',
          seatIndex: 0,
          isReady: true,
        },
        {
          playerId: 'b',
          nickname: 'ASD',
          seatIndex: 1,
          isReady: false,
        },
      ],
      readyCount: 1,
      requiredCount: 2,
    });
    renderTable();
    expect(
      screen.getByRole('button', { name: /ready — waiting/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /ready for next hand/i }),
    ).not.toBeInTheDocument();
  });

  it('busted viewer sees Rebuy instead of Ready during ready phase', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      viewerSeatIndex: 1,
      handComplete: true,
      street: 'SHOWDOWN',
      activeSeatIndex: null,
      seats: [
        { ...liveState.seats[0]!, stack: 400 },
        {
          ...liveState.seats[1]!,
          stack: 0,
          isSittingOut: true,
        },
      ],
    });
    useGameStore.getState().setNextHandReadyState({
      roomId,
      eligiblePlayers: [
        {
          playerId: 'a',
          nickname: 'ljhh',
          seatIndex: 0,
          isReady: false,
        },
      ],
      readyCount: 0,
      requiredCount: 1,
    });
    useSessionStore.setState({
      nickname: 'ASD',
      roomId,
      connectionStatus: 'connected',
    });
    const { container } = renderTable();
    expect(heroRebuyButton(container)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ready for next hand/i }),
    ).not.toBeInTheDocument();
  });

  it('after rebuy on completed hand board and result stay visible', () => {
    const boardCards = [
      { r: 'A', s: 's' },
      { r: 'K', s: 'h' },
      { r: 'Q', s: 'd' },
      { r: 'J', s: 'c' },
      { r: '10', s: 's' },
    ] as const;
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      handEndKind: 'SHOWDOWN',
      street: 'SHOWDOWN',
      activeSeatIndex: null,
      boardCards: [...boardCards],
      viewerSeatIndex: 1,
      seats: [
        { ...liveState.seats[0]!, stack: 400 },
        {
          ...liveState.seats[1]!,
          stack: 0,
          isSittingOut: true,
          holeCards: null,
          holeCardCount: null,
        },
      ],
    });
    useGameStore.getState().setHandResult({
      handId: 'hand-1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 400 },
      totalAwarded: 400,
    });
    const { container, rerender } = renderTable();
    expect(container.querySelector('.np-board')).toBeInTheDocument();
    expect(container.querySelector('.hand-result-banner')).toBeInTheDocument();

    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      handEndKind: 'SHOWDOWN',
      street: 'SHOWDOWN',
      activeSeatIndex: null,
      boardCards: [...boardCards],
      viewerSeatIndex: 1,
      seats: [
        { ...liveState.seats[0]!, stack: 400 },
        {
          ...liveState.seats[1]!,
          stack: 200,
          isSittingOut: false,
          holeCards: null,
          holeCardCount: null,
        },
      ],
    });
    rerender(
      <MemoryRouter initialEntries={[`/table/${roomId}`]}>
        <Routes>
          <Route path="/table/:roomId" element={<TablePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector('.np-board')).toBeInTheDocument();
    expect(container.querySelector('.hand-result-banner')).toBeInTheDocument();
    expect(heroRebuyButton(container)).toBeNull();
  });

  it('after rebuy viewer sees Ready when added to eligible list', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...idlePreHandState,
      seats: [
        { ...idlePreHandState.seats[0]!, stack: 400 },
        { ...idlePreHandState.seats[1]!, stack: 200, isSittingOut: false },
      ],
    });
    useGameStore.getState().setNextHandReadyState({
      roomId,
      eligiblePlayers: [
        {
          playerId: 'a',
          nickname: 'ljhh',
          seatIndex: 0,
          isReady: true,
        },
        {
          playerId: 'b',
          nickname: 'ASD',
          seatIndex: 1,
          isReady: false,
        },
      ],
      readyCount: 1,
      requiredCount: 2,
    });
    useSessionStore.setState({
      nickname: 'ASD',
      roomId,
      connectionStatus: 'connected',
    });
    renderTable();
    expect(
      screen.getByRole('button', { name: /ready for next hand/i }),
    ).toBeInTheDocument();
  });

  it('clears handResult when new SERVER_GAME_STATE starts next hand', () => {
    useGameStore.getState().setHandResult({
      handId: 'hand-1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 15 },
      totalAwarded: 15,
    });
    useGameStore.getState().setGameState({
      ...liveState,
      handId: 'hand-2',
      handComplete: false,
      street: 'PRE-FLOP',
    });
    expect(useGameStore.getState().handResult).toBeNull();
  });
});
