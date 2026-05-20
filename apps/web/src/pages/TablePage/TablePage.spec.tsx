import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import { TABLE_PAGE_MOCK } from '../../mocks/tableMock';
import * as socket from '../../net/socket';
import { TablePage } from './TablePage';
import { useGameStore } from '../../state/gameStore';
import { useRoomStore } from '../../state/roomStore';
import { useSessionStore } from '../../state/sessionStore';

vi.mock('../../net/socket', () => ({
  requestGameState: vi.fn(),
  startHand: vi.fn(),
  sendPlayerAction: vi.fn(),
  onGameState: vi.fn(() => () => {}),
  onHandResult: vi.fn(() => () => {}),
}));

const roomId = '11111111-1111-4111-8111-111111111111';

const soloRoom: RoomStatePayload = {
  roomId,
  code: 'ABC123',
  maxSeats: 9,
  status: 'waiting',
  players: [{ playerId: 'a', nickname: 'ljhh', seatIndex: 0 }],
};

const duoRoom: RoomStatePayload = {
  ...soloRoom,
  players: [
    { playerId: 'a', nickname: 'ljhh', seatIndex: 0 },
    { playerId: 'b', nickname: 'ASD', seatIndex: 1 },
  ],
};

const idlePreHandState: PlayerGameState = {
  tableId: roomId,
  maxSeats: 9,
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
    useRoomStore.setState({ roomState: null, lastError: null });
    useSessionStore.setState({
      nickname: 'ljhh',
      roomId,
      connectionStatus: 'connected',
    });
  });

  it('requests game state on mount', () => {
    renderTable();
    expect(socket.requestGameState).toHaveBeenCalledWith(roomId);
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
    useGameStore.getState().setGameLoading(true);
    renderTable();
    expect(
      screen.queryByText(`$${TABLE_PAGE_MOCK.potAmount}`),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/loading game state/i)).toBeInTheDocument();
    expect(document.querySelector('.np-board')).toBeNull();
  });

  it('clears loading display when room arrives without gameState', () => {
    useGameStore.getState().setGameLoading(true);
    useRoomStore.getState().setRoomState(soloRoom);
    renderTable();
    expect(screen.queryByText(/loading game state/i)).not.toBeInTheDocument();
    expect(screen.getByText('ljhh')).toBeInTheDocument();
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
});
