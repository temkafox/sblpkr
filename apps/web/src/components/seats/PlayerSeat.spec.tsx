import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LAYOUTS } from '../../lib/layout';
import { PlayerSeat } from './PlayerSeat';

const oppPos = LAYOUTS[2][1]!;

const player = {
  id: 'opp-1',
  name: 'Villain',
  stack: 350,
  avatar: null,
  ring: 'violet' as const,
  init: 'V',
};

describe('PlayerSeat', () => {
  it('keeps opponent nickname and stack visible with hole cards', () => {
    const { container } = render(
      <PlayerSeat
        player={player}
        state={{
          status: 'allin',
          bet: 0,
          showOppBackcards: true,
        }}
        position={oppPos}
        showHoles
      />,
    );

    const seat = container.querySelector('.seat')!;
    const holes = seat.querySelector('.np-opp-holes');
    const body = seat.querySelector('.body');

    expect(holes).not.toBeNull();
    expect(holes!.compareDocumentPosition(body!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(seat.querySelector('.name')?.textContent).toBe('Villain');
    expect(seat.querySelector('.stack')?.textContent).toBe('$350');
    expect(screen.getByText('ALL-IN')).toBeInTheDocument();
  });

  it('does not render Rebuy on busted opponent seat', () => {
    const { container } = render(
      <PlayerSeat
        player={{ ...player, stack: 0 }}
        state={{
          status: 'busted',
          bet: 0,
          showOppBackcards: false,
        }}
        position={oppPos}
        showHoles={false}
      />,
    );

    expect(container.querySelector('.seat-rebuy-btn')).toBeNull();
    expect(container.querySelector('.seat.hero')).toBeNull();
  });
});
