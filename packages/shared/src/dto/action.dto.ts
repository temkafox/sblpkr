import { z } from 'zod';

const fold = z.object({ kind: z.literal('fold') });
const check = z.object({ kind: z.literal('check') });
const call = z.object({ kind: z.literal('call') });
const raise = z.object({
  kind: z.literal('raise'),
  amount: z.number().finite().nonnegative(),
});
const allin = z.object({ kind: z.literal('allin') });

const PlayerActionIntentSchema = z.discriminatedUnion('kind', [
  fold,
  check,
  call,
  raise,
  allin,
]);

/** Client intent envelope — authoritative validation uses poker-core on the server. */

export const PlayerActionPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
  action: PlayerActionIntentSchema,
});

export type PlayerActionPayload = z.infer<typeof PlayerActionPayloadSchema>;

export type PlayerActionIntent = z.infer<typeof PlayerActionIntentSchema>;
