import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AvailableActions } from '@neonpoker/shared';

import { ActionBar, type ActionBarProps } from './ActionBar';

describe('ActionBar', () => {
  afterEach(() => {
    cleanup();
  });

  const availableActions: AvailableActions = {
    canFold: true,
    canCheck: false,
    canCall: true,
    callAmount: 5,
    canRaise: true,
    minRaise: 10,
    maxRaise: 100,
    canAllIn: true,
  };

  const baseProps: ActionBarProps = {
    availableActions,
    potAmount: 40,
    callAmount: 5,
    minRaise: 10,
    maxRaise: 100,
    isMyTurn: true,
    isSubmittingAction: false,
    onFold: vi.fn(),
    onCheck: vi.fn(),
    onCall: vi.fn(),
    onRaise: vi.fn(),
    onAllIn: vi.fn(),
  };

  it('renders disabled bar when not viewer turn', () => {
    const { container } = render(
      <ActionBar {...baseProps} isMyTurn={false} />,
    );
    expect(container.querySelector('.np-action-bar--disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: /fold/i })).toBeDisabled();
  });

  it('disables unavailable buttons from availableActions', () => {
    render(
      <ActionBar
        {...baseProps}
        availableActions={{
          ...availableActions,
          canCheck: false,
          canCall: false,
          canRaise: false,
          canAllIn: false,
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /call/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^raise to/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^all-in$/i })).toBeDisabled();
  });

  it('calls onFold/onCheck/onCall/onRaise/onAllIn correctly', () => {
    const onFold = vi.fn();
    const onCheck = vi.fn();
    const onCall = vi.fn();
    const onRaise = vi.fn();
    const onAllIn = vi.fn();

    render(
      <ActionBar
        {...baseProps}
        availableActions={{
          ...availableActions,
          canCheck: true,
          canCall: false,
        }}
        onFold={onFold}
        onCheck={onCheck}
        onCall={onCall}
        onRaise={onRaise}
        onAllIn={onAllIn}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    fireEvent.click(screen.getByRole('button', { name: /^raise to/i }));
    fireEvent.click(screen.getByRole('button', { name: /^all-in$/i }));

    expect(onFold).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCall).not.toHaveBeenCalled();
    expect(onRaise).toHaveBeenCalledWith(10);
    expect(onAllIn).toHaveBeenCalledTimes(1);
  });

  it('disabled ActionBar does not call handlers', () => {
    const onFold = vi.fn();
    render(
      <ActionBar {...baseProps} isMyTurn={false} onFold={onFold} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(onFold).not.toHaveBeenCalled();
  });

  it('quick buttons update raise amount', () => {
    render(<ActionBar {...baseProps} potAmount={100} />);
    fireEvent.click(screen.getByRole('button', { name: /1\/2 pot/i }));
    expect(screen.getByRole('button', { name: /^raise to \$50\.00/i })).toBeInTheDocument();
  });

  it('raise amount clamps to min/max via slider', () => {
    render(<ActionBar {...baseProps} />);
    const slider = screen.getByRole('slider', { name: /raise amount slider/i });
    fireEvent.change(slider, { target: { value: '100' } });
    expect(screen.getByRole('button', { name: /^raise to \$100\.00/i })).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /^raise to \$10\.00/i })).toBeInTheDocument();
  });

  it('disables controls while submitting', () => {
    const { container } = render(
      <ActionBar {...baseProps} isSubmittingAction />,
    );
    expect(container.querySelector('.np-action-bar--disabled')).not.toBeNull();
  });
});
