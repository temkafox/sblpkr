import type { HealthStatus } from '@neonpoker/shared';

/** Stub entry point — replaced in Phase 3+ with pure poker rules engine. */
export function createPokerCoreStub(): { name: string; health: HealthStatus } {
  return { name: 'poker-core-stub', health: 'ok' };
}
