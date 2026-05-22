import { z } from 'zod';

const ROOM_NAME_MAX = 32;

export const MaxSeatsSchema = z.union([
  z.literal(2),
  z.literal(4),
  z.literal(6),
  z.literal(9),
]);

export const RoomSettingsSchema = z
  .object({
    roomName: z
      .string()
      .trim()
      .max(
        ROOM_NAME_MAX,
        `Room name must be at most ${ROOM_NAME_MAX} characters`,
      )
      .optional()
      .default(''),
    maxSeats: MaxSeatsSchema.default(9),
    startingStack: z.number().int().positive(),
    smallBlind: z.number().int().min(1),
    bigBlind: z.number().int().min(1),
    rebuyAmount: z.number().int().positive(),
    maxRebuysPerPlayer: z.number().int().nonnegative().nullable(),
    actionTimeoutSeconds: z.number().int().min(5).max(120),
    disconnectGraceSeconds: z.number().int().min(5).max(120),
    allowSpectators: z.boolean(),
    chatEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.bigBlind < data.smallBlind) {
      ctx.addIssue({
        code: 'custom',
        message: 'Big blind must be greater than or equal to small blind',
        path: ['bigBlind'],
      });
    }
    const minStack = data.bigBlind * 20;
    if (data.startingStack < minStack) {
      ctx.addIssue({
        code: 'custom',
        message: `Starting stack must be at least ${minStack} (20 × big blind)`,
        path: ['startingStack'],
      });
    }
    const minRebuy = data.bigBlind * 20;
    if (data.rebuyAmount < minRebuy) {
      ctx.addIssue({
        code: 'custom',
        message: `Rebuy amount must be at least ${minRebuy} (20 × big blind)`,
        path: ['rebuyAmount'],
      });
    }
  });

export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = Object.freeze({
  roomName: 'Neon Table',
  maxSeats: 9,
  startingStack: 200,
  smallBlind: 1,
  bigBlind: 2,
  rebuyAmount: 200,
  maxRebuysPerPlayer: null,
  actionTimeoutSeconds: 30,
  disconnectGraceSeconds: 30,
  allowSpectators: false,
  chatEnabled: true,
});

const RoomSettingsPartialSchema = z.object({
  roomName: z.string().trim().max(ROOM_NAME_MAX).optional(),
  maxSeats: MaxSeatsSchema.optional(),
  startingStack: z.number().int().positive().optional(),
  smallBlind: z.number().int().min(1).optional(),
  bigBlind: z.number().int().min(1).optional(),
  rebuyAmount: z.number().int().positive().optional(),
  maxRebuysPerPlayer: z.number().int().nonnegative().nullable().optional(),
  actionTimeoutSeconds: z.number().int().min(5).max(120).optional(),
  disconnectGraceSeconds: z.number().int().min(5).max(120).optional(),
  allowSpectators: z.boolean().optional(),
  chatEnabled: z.boolean().optional(),
});

export type RoomSettingsPartial = z.infer<typeof RoomSettingsPartialSchema>;

export type { RoomSettingsPartial as RoomSettingsInputPartial };

export const CreateRoomSettingsInputSchema = z.object({
  settings: RoomSettingsPartialSchema.optional(),
});

export type CreateRoomSettingsInput = z.infer<
  typeof CreateRoomSettingsInputSchema
>;

function normalizeRoomName(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Neon Table';
}

/** Merge partial create payload with defaults and validate final settings. */
export function mergeRoomSettings(
  partial?: RoomSettingsPartial | null,
): RoomSettings {
  const input = partial ?? {};
  const smallBlind = input.smallBlind ?? DEFAULT_ROOM_SETTINGS.smallBlind;
  const bigBlind =
    input.bigBlind ??
    (input.smallBlind != null
      ? input.smallBlind * 2
      : DEFAULT_ROOM_SETTINGS.bigBlind);

  const merged = {
    roomName: normalizeRoomName(input.roomName),
    maxSeats: input.maxSeats ?? DEFAULT_ROOM_SETTINGS.maxSeats,
    startingStack: input.startingStack ?? DEFAULT_ROOM_SETTINGS.startingStack,
    smallBlind,
    bigBlind,
    rebuyAmount: input.rebuyAmount ?? DEFAULT_ROOM_SETTINGS.rebuyAmount,
    maxRebuysPerPlayer:
      input.maxRebuysPerPlayer !== undefined
        ? input.maxRebuysPerPlayer
        : DEFAULT_ROOM_SETTINGS.maxRebuysPerPlayer,
    actionTimeoutSeconds:
      input.actionTimeoutSeconds ??
      DEFAULT_ROOM_SETTINGS.actionTimeoutSeconds,
    disconnectGraceSeconds:
      input.disconnectGraceSeconds ??
      DEFAULT_ROOM_SETTINGS.disconnectGraceSeconds,
    allowSpectators:
      input.allowSpectators ?? DEFAULT_ROOM_SETTINGS.allowSpectators,
    chatEnabled: input.chatEnabled ?? DEFAULT_ROOM_SETTINGS.chatEnabled,
  };

  return RoomSettingsSchema.parse(merged);
}
