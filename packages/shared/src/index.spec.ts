import { describe, expect, it } from 'vitest';
import type { HealthStatus } from './index';

describe('@neonpoker/shared', () => {
  it('exports HealthStatus stub', () => {
    const status: HealthStatus = 'ok';
    expect(status).toBe('ok');
  });
});
