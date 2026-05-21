import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NextHandPanel } from './NextHandPanel';

describe('NextHandPanel', () => {
  it('renders eligible players with ready and waiting icons', () => {
    render(
      <NextHandPanel
        readyState={{
          roomId: 'room-1',
          eligiblePlayers: [
            {
              playerId: 'a',
              nickname: 'Alpha',
              seatIndex: 0,
              isReady: true,
            },
            {
              playerId: 'b',
              nickname: 'Beta',
              seatIndex: 1,
              isReady: false,
            },
          ],
          readyCount: 1,
          requiredCount: 2,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /next hand/i })).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });
});
