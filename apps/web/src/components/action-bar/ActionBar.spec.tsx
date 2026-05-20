import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ActionBarMock } from '../../mocks/tableMock';
import { ActionBar } from './ActionBar';

describe('ActionBar disabled state', () => {
  afterEach(() => {
    cleanup();
  });

  const baseMock: ActionBarMock = {
    potAmount: 10,
    toCall: 5,
    minRaise: 10,
    maxRaise: 100,
    canCheck: false,
    raiseDisplayAmount: 10,
    sliderPct: 0,
    activeQuickId: null,
  };

  it('renders disabled bar when actionsEnabled is false', () => {
    const { container } = render(
      <ActionBar mock={{ ...baseMock, actionsEnabled: false }} />,
    );
    expect(container.querySelector('.np-action-bar--disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: /fold/i })).toBeDisabled();
  });

  it('renders enabled bar when actionsEnabled is true', () => {
    const { container } = render(
      <ActionBar mock={{ ...baseMock, actionsEnabled: true, canCheck: true }} />,
    );
    expect(container.querySelector('.np-action-bar--disabled')).toBeNull();
    expect(container.querySelector('.np-ab-check:not([disabled])')).not.toBeNull();
  });
});
