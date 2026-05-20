import { describe, expect, it } from 'vitest';
import type { HealthStatus } from '@neonpoker/shared';

describe('@neonpoker/web', () => {
  it('imports @neonpoker/shared', () => {
    const status: HealthStatus = 'ok';
    expect(status).toBe('ok');
  });
});
