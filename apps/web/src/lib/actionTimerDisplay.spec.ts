import { describe, expect, it } from 'vitest';

import { actionTimerBarStyle } from './actionTimerDisplay';

describe('actionTimerDisplay', () => {
  it('returns animation duration from server deadline only', () => {
    const deadline = Date.now() + 8000;
    const style = actionTimerBarStyle(deadline);
    expect(style?.animationDuration).toBe('8s');
    expect(style?.animationName).toBe('np-timer-deplete');
  });

  it('returns undefined without deadline (display-only, no client auto-action)', () => {
    expect(actionTimerBarStyle(null)).toBeUndefined();
  });
});
