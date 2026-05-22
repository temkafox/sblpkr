import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JoinRoomPage } from './JoinRoomPage';
import * as roomSession from '../../net/roomSession';
import * as roomsApi from '../../net/roomsApi';
import { useSessionStore } from '../../state/sessionStore';
import { mockCreateRoomResponse, mockGetRoomResponse } from '../../test/roomFixtures';

vi.mock('../../net/roomsApi', () => ({
  createRoom: vi.fn(),
  getRoom: vi.fn(),
}));

vi.mock('../../net/roomSession', () => ({
  establishRoomSession: vi.fn(),
}));

const roomId = '11111111-1111-4111-8111-111111111111';

describe('JoinRoomPage backend integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      nickname: null,
      roomId: null,
      connectionStatus: 'idle',
    });
    vi.clearAllMocks();
  });

  function renderJoin(initialPath = '/join') {
    const router = createMemoryRouter(
      [
        { path: '/join', element: <JoinRoomPage /> },
        { path: '/room/:roomId', element: <JoinRoomPage /> },
        { path: '/table/:roomId', element: <div data-testid="table">table</div> },
      ],
      { initialEntries: [initialPath] },
    );
    render(<RouterProvider router={router} />);
    return router;
  }

  it('create room settings panel sends settings payload', async () => {
    vi.mocked(roomsApi.createRoom).mockResolvedValue({
      roomId,
      code: 'ABC123',
      maxSeats: 6,
      status: 'waiting',
      seatedCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      settings: {
        roomName: 'Neon Table',
        maxSeats: 6,
        startingStack: 500,
        smallBlind: 5,
        bigBlind: 10,
        rebuyAmount: 500,
        maxRebuysPerPlayer: 1,
        actionTimeoutSeconds: 10,
        disconnectGraceSeconds: 30,
        allowSpectators: false,
        chatEnabled: true,
      },
    });
    vi.mocked(roomSession.establishRoomSession).mockResolvedValue({
      room: {
        roomId,
        code: 'ABC123',
        maxSeats: 6,
        status: 'waiting',
        seatedCount: 0,
        capacityAvailable: true,
        settings: {
          roomName: 'Neon Table',
          maxSeats: 6,
          startingStack: 500,
          smallBlind: 5,
          bigBlind: 10,
          rebuyAmount: 500,
          maxRebuysPerPlayer: 1,
          actionTimeoutSeconds: 10,
          disconnectGraceSeconds: 30,
          allowSpectators: false,
          chatEnabled: true,
        },
      },
      roomId,
    });

    renderJoin();

    fireEvent.change(screen.getAllByLabelText(/^nickname$/i)[0]!, {
      target: { value: 'alice' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /create room settings/i }),
    );
    fireEvent.change(screen.getByLabelText(/starting stack/i), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText(/small blind/i), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(/big blind/i), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/max players/i), {
      target: { value: '6' },
    });
    fireEvent.click(screen.getByLabelText(/unlimited rebuys/i));
    fireEvent.change(screen.getByLabelText(/max rebuys per player/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/turn time/i), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create room$/i }));

    await waitFor(() => {
      expect(roomsApi.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          startingStack: 500,
          smallBlind: 5,
          bigBlind: 10,
          maxSeats: 6,
          maxRebuysPerPlayer: 1,
          actionTimeoutSeconds: 10,
        }),
      );
    });
  });

  it('Create Room calls createRoom then establishRoomSession', async () => {
    vi.mocked(roomsApi.createRoom).mockResolvedValue(mockCreateRoomResponse({ roomId }));
    vi.mocked(roomSession.establishRoomSession).mockResolvedValue({
      room: mockGetRoomResponse({ roomId }),
      roomId,
    });

    const router = renderJoin();

    fireEvent.change(screen.getAllByLabelText(/^nickname$/i)[0]!, {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create room$/i }));

    await waitFor(() => {
      expect(roomsApi.createRoom).toHaveBeenCalled();
      expect(roomSession.establishRoomSession).toHaveBeenCalledWith(
        'alice',
        roomId,
      );
      expect(router.state.location.pathname).toBe(`/table/${roomId}`);
    });
  });

  it('Join Room calls establishRoomSession with room lookup', async () => {
    vi.mocked(roomSession.establishRoomSession).mockResolvedValue({
      room: mockGetRoomResponse({ roomId, seatedCount: 1 }),
      roomId,
    });

    const router = renderJoin();

    fireEvent.change(screen.getAllByLabelText(/^nickname$/i)[0]!, {
      target: { value: 'bob' },
    });
    fireEvent.change(screen.getByLabelText(/room code/i), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^join room$/i }));

    await waitFor(() => {
      expect(roomSession.establishRoomSession).toHaveBeenCalledWith(
        'bob',
        'ABC123',
      );
      expect(router.state.location.pathname).toBe(`/table/${roomId}`);
    });
  });

  it('shows inline error when establishRoomSession fails', async () => {
    const { SocketRoomError } = await import('../../net/socket');
    vi.mocked(roomSession.establishRoomSession).mockRejectedValue(
      new SocketRoomError({ code: 'NICKNAME_TAKEN' }),
    );

    renderJoin();

    fireEvent.change(screen.getAllByLabelText(/^nickname$/i)[0]!, {
      target: { value: 'neo' },
    });
    fireEvent.change(screen.getByLabelText(/room code/i), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^join room$/i }));

    await waitFor(() => {
      expect(document.querySelector('.jr-panel__error')).toHaveTextContent(
        /nickname is already taken/i,
      );
    });
  });
});
