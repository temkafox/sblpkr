/** Intent envelope consumed later by `applyAction` / gateway guards — **no validation** in Phase 3. */

export type CorePlayerAction =
  | { readonly kind: 'fold' }
  | { readonly kind: 'check' }
  | { readonly kind: 'call' }
  | { readonly kind: 'raise'; readonly amount: number }
  | { readonly kind: 'allin' };
