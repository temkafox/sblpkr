import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  RegisterNicknamePayloadSchema,
} from '@neonpoker/shared';

describe('@neonpoker/shared workspace import', () => {
  it('parses nickname payloads through the package barrel', () => {
    expect(
      RegisterNicknamePayloadSchema.safeParse({
        nickname: 'alice_01',
        clientSessionId: 'browser-alice',
      }).success,
    ).toBe(true);
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
