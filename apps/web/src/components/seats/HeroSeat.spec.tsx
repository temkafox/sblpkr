import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LAYOUTS } from '../../lib/layout';
import { HeroSeat } from './HeroSeat';

const heroPos = LAYOUTS[2][0]!;

const player = {
  id: 'hero-1',
  name: 'Hero',
  stack: 400,
  avatar: null,
  ring: 'cyan' as const,
  init: 'H',
};

const baseState = {
  status: 'turn' as const,
  bet: 0,
  showOppBackcards: false,
};

describe('HeroSeat', () => {
  it('renders hole cards inside hero seat before the panel body', () => {
    const { container } = render(
      <HeroSeat
        player={player}
        state={baseState}
        position={heroPos}
        holeCards={[
          { r: 'A', s: 's' },
          { r: 'K', s: 'h' },
        ]}
      />,
    );

    const seat = container.querySelector('.seat.hero')!;
    const holes = seat.querySelector('.np-hero-holes');
    const body = seat.querySelector('.body');

    expect(holes).not.toBeNull();
    expect(body).not.toBeNull();
    expect(holes!.compareDocumentPosition(body!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps stack and status visible with hole cards', () => {
    const { container } = render(
      <HeroSeat
        player={player}
        state={{ ...baseState, status: 'winner' }}
        position={heroPos}
        holeCards={[
          { r: 'Q', s: 'd' },
          { r: 'J', s: 'c' },
        ]}
      />,
    );

    const seat = container.querySelector('.seat.hero')!;
    expect(seat.querySelector('.name')?.textContent).toBe('Hero');
    expect(seat.querySelector('.stack')?.textContent).toBe('$400');
    expect(seat.querySelector('.status')?.textContent).toBe('WINNER');
  });

  it('shows YOUR TURN label with hole cards present', () => {
    const { container } = render(
      <HeroSeat
        player={player}
        state={baseState}
        position={heroPos}
        holeCards={[
          { r: '2', s: 'h' },
          { r: '3', s: 'h' },
        ]}
      />,
    );

    expect(container.querySelector('.seat.hero .status')?.textContent).toBe(
      'YOUR TURN',
    );
  });

  const bustedPlayer = { ...player, stack: 0 };
  const bustedState = { ...baseState, status: 'busted' as const, bet: 0 };

  it('renders Rebuy inside busted hero seat card', () => {
    const { container } = render(
      <HeroSeat
        player={bustedPlayer}
        state={bustedState}
        position={heroPos}
        showRebuy
        rebuyAmount={200}
      />,
    );

    const seat = container.querySelector('.seat.hero')!;
    const rebuyBtn = seat.querySelector('.seat-rebuy-btn');
    expect(rebuyBtn).not.toBeNull();
    expect(rebuyBtn?.textContent).toMatch(/rebuy \$200/i);
    expect(seat).toHaveClass('seat--has-rebuy');
  });

  it('keeps rebuy outside body-inner so name stack and status layout stay stable', () => {
    const { container: withRebuy } = render(
      <HeroSeat
        player={bustedPlayer}
        state={bustedState}
        position={heroPos}
        showRebuy
      />,
    );
    const { container: withoutRebuy } = render(
      <HeroSeat
        player={bustedPlayer}
        state={bustedState}
        position={heroPos}
      />,
    );

    const innerWith = withRebuy.querySelector('.seat.hero .body-inner')!;
    const innerWithout = withoutRebuy.querySelector('.seat.hero .body-inner')!;

    expect(innerWith.children.length).toBe(3);
    expect(innerWithout.children.length).toBe(3);
    expect(innerWith.innerHTML).toBe(innerWithout.innerHTML);
    expect(withRebuy.querySelector('.seat-rebuy-btn')?.parentElement).toHaveClass(
      'body',
    );
    expect(withRebuy.querySelector('.body-inner .seat-rebuy-btn')).toBeNull();

    expect(withRebuy.querySelector('.name')?.textContent).toBe('Hero');
    expect(withRebuy.querySelector('.stack')?.textContent).toBe('$0');
    expect(withRebuy.querySelector('.status')?.textContent).toBe('BUSTED');
  });

  it('does not render Rebuy on non-busted hero', () => {
    const { container } = render(
      <HeroSeat player={player} state={baseState} position={heroPos} />,
    );

    expect(container.querySelector('.seat-rebuy-btn')).toBeNull();
    expect(container.querySelector('.seat.hero')).not.toHaveClass('seat--has-rebuy');
  });
});
