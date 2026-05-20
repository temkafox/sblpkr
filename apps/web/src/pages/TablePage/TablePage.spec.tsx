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
  rebuy: vi.fn(),
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
    renderTable();
    expect(screen.getByRole('button', { name: /rebuy \$200/i })).toBeInTheDocument();
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
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /rebuy \$200/i }));
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

  it('Start Next Hand emits startHand when hand is complete', () => {
    useRoomStore.getState().setRoomState(duoRoom);
    useGameStore.getState().setGameState({
      ...liveState,
      handComplete: true,
      street: 'SHOWDOWN',
      activeSeatIndex: null,
    });
    useGameStore.getState().setHandResult({
      handId: 'hand-1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 15 },
      totalAwarded: 15,
    });
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /start next hand/i }));
    expect(socket.startHand).toHaveBeenCalledWith(roomId);
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
