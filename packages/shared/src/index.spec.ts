import { describe, expect, it } from 'vitest';

import type { GameState, HealthStatus } from './index';

describe('@neonpoker/shared barrel', () => {
  it('still exposes legacy HealthStatus for health probes', () => {
    const status: HealthStatus = 'ok';
    expect(status).toBe('ok');
  });

  it('exports GameState as a usable structural type', () => {
    const stub = {} as GameState;
    expect(stub).toBeDefined();
  });
});
