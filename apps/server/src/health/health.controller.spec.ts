import { describe, expect, it } from 'vitest';
import type { HealthStatus } from '@neonpoker/shared';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status', () => {
    const controller = new HealthController();
    const result = controller.getHealth();
    const status: HealthStatus = result.status;
    expect(status).toBe('ok');
  });
});
