import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { HandResultPayload } from '@neonpoker/shared';

import { HandResultBanner } from './HandResultBanner';

describe('HandResultBanner', () => {
  afterEach(() => {
    cleanup();
  });

  const room = {
    roomId: 'room-1',
    code: 'ABC',
    maxSeats: 9,
    status: 'waiting' as const,
    players: [
      { playerId: 'a', nickname: 'Alice', seatIndex: 0 },
      { playerId: 'b', nickname: 'Bob', seatIndex: 1 },
    ],
  };

  it('renders winner nickname and awarded amount', () => {
    const result: HandResultPayload = {
      handId: 'h1',
      winnerSeatIndexes: [0],
      awardedAmountsBySeatIndex: { '0': 15 },
      totalAwarded: 15,
      isFoldWin: true,
    };
    render(
      <HandResultBanner result={result} roomState={room} gameState={null} />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('+$15')).toBeInTheDocument();
    expect(screen.getByText(/hand complete/i)).toBeInTheDocument();
  });

  it('renders split pot winners', () => {
    const result: HandResultPayload = {
      handId: 'h2',
      winnerSeatIndexes: [0, 1],
      awardedAmountsBySeatIndex: { '0': 10, '1': 10 },
      totalAwarded: 20,
      winningHandLabel: 'Two Pair',
    };
    render(
      <HandResultBanner result={result} roomState={room} gameState={null} />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/split pot/i)).toBeInTheDocument();
  });

  it('does not render deck or hole card fields', () => {
    const result: HandResultPayload = {
      handId: 'h3',
      winnerSeatIndexes: [1],
      awardedAmountsBySeatIndex: { '1': 20 },
      totalAwarded: 20,
    };
    const { container } = render(
      <HandResultBanner result={result} roomState={room} gameState={null} />,
    );
    expect(container.textContent).not.toMatch(/deck/i);
    expect(result).not.toHaveProperty('holeCards');
  });
});
