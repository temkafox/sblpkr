import { describe, expect, it } from 'vitest';
import type { HealthStatus } from '@neonpoker/shared';

describe('@neonpoker/shared', () => {
  it('imports shared types', () => {
    const status: HealthStatus = 'ok';
    expect(status).toBe('ok');
  });
});
