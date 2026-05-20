import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HandHistoryPanel } from './HandHistoryPanel';

describe('HandHistoryPanel', () => {
  it('renders empty state when no streets', () => {
    render(<HandHistoryPanel streets={[]} />);
    expect(screen.getByText(/no hand history yet/i)).toBeInTheDocument();
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
