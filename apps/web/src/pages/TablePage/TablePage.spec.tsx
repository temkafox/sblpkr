import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerGameState } from '@neonpoker/shared';

import { TABLE_PAGE_MOCK } from '../../mocks/tableMock';
import * as socket from '../../net/socket';
import { TablePage } from './TablePage';
import { useGameStore } from '../../state/gameStore';
import { useRoomStore } from '../../state/roomStore';
import { useSessionStore } from '../../state/sessionStore';

vi.mock('../../net/socket', () => ({
  requestGameState: vi.fn(),
  startHand: vi.fn(),
  onGameState: vi.fn(() => () => {}),
  onHandResult: vi.fn(() => () => {}),
}));

const roomId = '11111111-1111-4111-8111-111111111111';

const liveState: PlayerGameState = {
  tableId: roomId,
  maxSeats: 2,
  street: 'PRE-FLOP',
  boardCards: [],
  pot: { total: 3, sidePots: [] },
  dealerSeatIndex: 0,
  smallBlindSeatIndex: 0,
  bigBlindSeatIndex: 1,
  activeSeatIndex: 0,
  handId: 'hand-1',
  handComplete: false,
  showdownReady: false,
  seats: [
    {
      seatIndex: 0,
      playerId: 'a',
      nickname: 'Alice',
      stack: 100,
      currentBet: 1,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: [
        { r: '2', s: 'h' },
        { r: '3', s: 'h' },
      ],
      holeCardCount: 2,
    },
    {
      seatIndex: 1,
      playerId: 'b',
      nickname: 'Bob',
      stack: 99,
      currentBet: 2,
      hasFolded: false,
      isAllIn: false,
      isSittingOut: false,
      holeCards: null,
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

describe('TablePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().clearGameState();
    useRoomStore.setState({ roomState: null, lastError: null });
    useSessionStore.setState({
      nickname: 'Alice',
      roomId,
      connectionStatus: 'connected',
    });
  });

  it('requests game state on mount', () => {
    renderTable();
    expect(socket.requestGameState).toHaveBeenCalledWith(roomId);
  });

  it('renders mock fallback when no game state', () => {
    const { container } = renderTable();
    expect(container.querySelector('.np-pot-amt')?.textContent).toBe(
      `$${TABLE_PAGE_MOCK.potAmount.toFixed(2)}`,
    );
    expect(screen.getByRole('button', { name: /start hand/i })).toBeInTheDocument();
  });

  it('renders live pot from SERVER_GAME_STATE adaptation', () => {
    useGameStore.getState().setGameState(liveState);
    const { container } = renderTable();
    expect(container.querySelector('.np-pot-amt')?.textContent).toBe('$3.00');
    expect(screen.queryByRole('button', { name: /start hand/i })).not.toBeInTheDocument();
  });

  it('Start Hand emits startHand', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /start hand/i }));
    expect(socket.startHand).toHaveBeenCalledWith(roomId);
  });
});
