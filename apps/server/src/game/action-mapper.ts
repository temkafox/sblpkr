import type { CorePlayerAction } from '@neonpoker/poker-core';
import type { PlayerActionIntent } from '@neonpoker/shared';

/** Maps shared wire intent to poker-core action (no rule logic). */

export function toCorePlayerAction(
  action: PlayerActionIntent,
): CorePlayerAction {
  switch (action.kind) {
    case 'fold':
      return { kind: 'fold' };
    case 'check':
      return { kind: 'check' };
    case 'call':
      return { kind: 'call' };
    case 'raise':
      return { kind: 'raise', amount: action.amount };
    case 'allin':
      return { kind: 'allin' };
  }
}
