import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as roomSession from './net/roomSession';
import * as socketNet from './net/socket';
import {
  clearTableRouteReconnectKeysForTests,
  TableRoute,
} from './routes/TableRoute';
import { useRoomStore } from './state/roomStore';
import { useSessionStore } from './state/sessionStore';
import { mockGetRoomResponse, mockRoomState } from './test/roomFixtures';

vi.mock('./net/roomSession', () => ({
  establishRoomSession: vi.fn(),
  reconnectRoomSession: vi.fn(),
}));

vi.mock('./net/socket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./net/socket')>();
  return {
    ...actual,
    getSocket: vi.fn(() => null),
  };
});

const roomId = '11111111-1111-4111-8111-111111111111';

describe('TableRoute guard', () => {
  beforeEach(() => {
    clearTableRouteReconnectKeysForTests();
    localStorage.clear();
    useSessionStore.setState({
      nickname: null,
      roomId: null,
      connectionStatus: 'idle',
    });
    useRoomStore.setState({ roomState: null, lastError: null });
    vi.clearAllMocks();
  });

  function renderGuard(initialPath: string) {
    const router = createMemoryRouter(
      [
        { path: '/table/:roomId', element: <TableRoute /> },
        {
          path: '/room/:roomId',
          element: <div data-testid="room-gate">room gate</div>,
        },
        { path: '/join', element: <div data-testid="join-gate">join</div> },
      ],
      { initialEntries: [initialPath] },
    );

    render(<RouterProvider router={router} />);
    return router;
  }

  it('redirects to /room/:roomId when nickname is missing', async () => {
    const router = renderGuard('/table/ABC1234');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/room/ABC1234');
    });
  });

  it('renders TablePage when nickname is present', async () => {
    vi.mocked(socketNet.getSocket).mockReturnValue({
      connected: true,
    } as ReturnType<typeof socketNet.getSocket>);

    useSessionStore.setState({
      nickname: 'alice',
      roomId,
      connectionStatus: 'connected',
    });
    useRoomStore.setState({
      roomState: mockRoomState({ roomId }),
      lastError: null,
    });

    const router = renderGuard(`/table/${roomId}`);

    await waitFor(() => {
      expect(document.querySelector('.table-page')).not.toBeNull();
    });

    expect(router.state.location.pathname).toBe(`/table/${roomId}`);
    expect(roomSession.reconnectRoomSession).not.toHaveBeenCalled();
  });

  it('reconnects when store says connected but socket is dead', async () => {
    vi.mocked(socketNet.getSocket).mockReturnValue(null);
    vi.mocked(roomSession.reconnectRoomSession).mockResolvedValue({
      room: mockGetRoomResponse({ roomId }),
      roomId,
    });

    useSessionStore.setState({
      nickname: 'alice',
      roomId,
      connectionStatus: 'connected',
    });
    useRoomStore.setState({
      roomState: mockRoomState({ roomId }),
      lastError: null,
    });

    renderGuard(`/table/${roomId}`);

    await waitFor(() => {
      expect(roomSession.reconnectRoomSession).toHaveBeenCalledTimes(1);
    });
  });

  it('attempts reconnect once when disconnected', async () => {
    vi.mocked(roomSession.reconnectRoomSession).mockResolvedValue({
      room: mockGetRoomResponse({ roomId }),
      roomId,
    });

    useSessionStore.setState({
      nickname: 'alice',
      roomId,
      connectionStatus: 'idle',
    });

    renderGuard(`/table/${roomId}`);

    await waitFor(() => {
      expect(roomSession.reconnectRoomSession).toHaveBeenCalledTimes(1);
      expect(roomSession.reconnectRoomSession).toHaveBeenCalledWith(
        'alice',
        roomId,
      );
    });
  });
});
