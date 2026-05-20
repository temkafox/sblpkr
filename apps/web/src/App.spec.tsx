import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from './App';
import { useSessionStore } from './state/sessionStore';

describe('App smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({ nickname: null, roomId: null });
  });

  it('renders join heading at /join', () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /enter room/i }),
    ).toBeInTheDocument();
  });
});
