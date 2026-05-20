import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HandHistoryPanel } from './HandHistoryPanel';

describe('HandHistoryPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no streets', () => {
    render(<HandHistoryPanel streets={[]} />);
    expect(screen.getByText(/no hand history yet/i)).toBeInTheDocument();
  });

  it('scrolls to bottom when new entries are added', () => {
    const { container, rerender } = render(<HandHistoryPanel streets={[]} />);
    const scroll = container.querySelector('.np-hh-scroll') as HTMLDivElement;
    Object.defineProperty(scroll, 'scrollHeight', {
      value: 320,
      configurable: true,
    });
    let scrollTop = 0;
    Object.defineProperty(scroll, 'scrollTop', {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
      configurable: true,
    });

    rerender(
      <HandHistoryPanel
        streets={[
          {
            street: 'PRE-FLOP',
            rows: [{ name: 'Alpha', cls: 'n-c', act: 'raises to $8' }],
          },
        ]}
      />,
    );

    expect(scrollTop).toBe(320);
  });

  it('renders inside a scrollable history container', () => {
    const { container } = render(<HandHistoryPanel streets={[]} />);
    const panel = container.querySelector('.np-hand-history');
    const body = container.querySelector('.np-hh-body');
    const scroll = container.querySelector('.np-hh-scroll');
    expect(panel).not.toBeNull();
    expect(body).not.toBeNull();
    expect(scroll).not.toBeNull();
    expect(panel?.className).toContain('np-hand-history');
    expect(scroll?.className).toContain('np-hh-scroll');
  });

  it('renders grouped streets with action amounts', () => {
    render(
      <HandHistoryPanel
        streets={[
          {
            street: 'PRE-FLOP',
            rows: [
              { name: 'Alpha', cls: 'n-c', act: 'calls $2' },
              { name: 'Beta', cls: 'n-m', act: 'raises to $8' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText('PRE-FLOP')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('calls $2')).toBeInTheDocument();
    expect(screen.getByText('raises to $8')).toBeInTheDocument();
  });
});
