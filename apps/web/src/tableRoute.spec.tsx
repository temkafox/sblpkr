import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { TableRoute } from './routes/TableRoute';
import { useSessionStore } from './state/sessionStore';

describe('TableRoute guard', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({ nickname: null, roomId: null });
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
    useSessionStore.setState({ nickname: 'alice', roomId: null });

    const router = renderGuard('/table/ABC1234');

    await waitFor(() => {
      expect(document.querySelector('.table-page')).not.toBeNull();
    });

    expect(router.state.location.pathname).toBe('/table/ABC1234');
  });
});
