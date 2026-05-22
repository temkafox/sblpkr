import type { CSSProperties } from 'react';

/** Display-only bar animation from server deadline (no client auto-action). */
export function actionTimerBarStyle(
  deadlineAt: number | null | undefined,
): CSSProperties | undefined {
  if (deadlineAt == null) {
    return undefined;
  }
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  const durationSec = remainingMs / 1000;
  return {
    animationDuration: `${durationSec}s`,
    animationTimingFunction: 'linear',
    animationName: 'np-timer-deplete',
    animationFillMode: 'forwards',
  };
}
