import { z } from 'zod';

import { ChipAmountSchema } from './chip-amount';

const cardSchema = z.object({
  r: z.enum([
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
    'A',
  ]),
  s: z.enum(['h', 'd', 's', 'c']),
});

const streetSchema = z.enum([
  'PRE-FLOP',
  'FLOP',
  'TURN',
  'RIVER',
  'SHOWDOWN',
]);

const handEndKindSchema = z.enum(['FOLD_WIN', 'SHOWDOWN']);

const sidePotSchema = z.object({
  amount: ChipAmountSchema,
  eligibleSeatIndexes: z.array(z.number().int().nonnegative()),
});

const potViewSchema = z.object({
  total: ChipAmountSchema,
  sidePots: z.array(sidePotSchema),
});

const availableActionsSchema = z.object({
  canFold: z.boolean(),
  canCheck: z.boolean(),
  canCall: z.boolean(),
  callAmount: ChipAmountSchema,
  canRaise: z.boolean(),
  minRaise: ChipAmountSchema,
  maxRaise: ChipAmountSchema,
  canAllIn: z.boolean(),
});

/** Latest public betting action for seat HUD labels (no hole cards / deck). */
export const PublicSeatActionKindSchema = z.enum([
  'fold',
  'check',
  'call',
  'raise',
  'allin',
  'post_sb',
  'post_bb',
]);

export const PublicSeatActionSchema = z.object({
  kind: PublicSeatActionKindSchema,
  amount: ChipAmountSchema.optional(),
});

export const WireSeatViewSchema = z.object({
  seatIndex: z.number().int().nonnegative(),
  playerId: z.string().nullable(),
  nickname: z.string().nullable(),
  stack: ChipAmountSchema,
  currentBet: ChipAmountSchema,
  hasFolded: z.boolean(),
  isAllIn: z.boolean(),
  isSittingOut: z.boolean(),
  holeCards: z.array(cardSchema).nullable(),
  holeCardCount: z.number().int().nonnegative().nullable(),
  lastAction: PublicSeatActionSchema.nullable().optional(),
  isWinner: z.boolean().optional(),
  connectionStatus: z.enum(['connected', 'disconnected']).optional(),
});

export const PublicGameStateSchema = z.object({
  tableId: z.string().min(1),
  maxSeats: z.number().int().positive(),
  street: streetSchema.nullable(),
  boardCards: z.array(cardSchema),
  pot: potViewSchema,
  dealerSeatIndex: z.number().int().nonnegative().nullable(),
  smallBlindSeatIndex: z.number().int().nonnegative().nullable(),
  bigBlindSeatIndex: z.number().int().nonnegative().nullable(),
  activeSeatIndex: z.number().int().nonnegative().nullable(),
  seats: z.array(WireSeatViewSchema),
  handId: z.string().nullable(),
  handComplete: z.boolean(),
  showdownReady: z.boolean(),
  handEndKind: handEndKindSchema.nullable().optional(),
  winnerSeatIndexes: z.array(z.number().int().nonnegative()).optional(),
});

export const PlayerGameStateSchema = PublicGameStateSchema.extend({
  viewerSeatIndex: z.number().int().nonnegative(),
  availableActions: availableActionsSchema.optional(),
});

export const HandResultPotSchema = z.object({
  potIndex: z.number().int().nonnegative(),
  amount: ChipAmountSchema,
  winningSeatIndexes: z.array(z.number().int().nonnegative()),
  awardedAmountsBySeatIndex: z.record(z.string(), ChipAmountSchema),
  winningHandLabel: z.string().nullable().optional(),
});

export const HandResultPayloadSchema = z
  .object({
    handId: z.string().min(1),
    winnerSeatIndexes: z.array(z.number().int().nonnegative()),
    awardedAmountsBySeatIndex: z.record(z.string(), ChipAmountSchema),
    totalAwarded: ChipAmountSchema,
    isFoldWin: z.boolean().optional(),
    potResults: z.array(HandResultPotSchema).optional(),
    winningHandLabel: z.string().nullable().optional(),
  })
  .strict();

export type HandResultPot = z.infer<typeof HandResultPotSchema>;

export const StartHandPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export const RequestGameStatePayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export const RebuyPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export const SetNextHandReadyPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export const NextHandReadyPlayerSchema = z.object({
  playerId: z.string().min(1),
  nickname: z.string().min(1),
  seatIndex: z.number().int().nonnegative(),
  isReady: z.boolean(),
});

export const NextHandReadyStatePayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
  eligiblePlayers: z.array(NextHandReadyPlayerSchema),
  readyCount: z.number().int().nonnegative(),
  requiredCount: z.number().int().nonnegative(),
});

export const RebuyConfirmedPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
  seatIndex: z.number().int().nonnegative(),
  chips: ChipAmountSchema,
});

export type PublicSeatActionKind = z.infer<typeof PublicSeatActionKindSchema>;
export type PublicSeatAction = z.infer<typeof PublicSeatActionSchema>;
export type WireSeatView = z.infer<typeof WireSeatViewSchema>;
export type PublicGameState = z.infer<typeof PublicGameStateSchema>;
export type PlayerGameState = z.infer<typeof PlayerGameStateSchema>;
export type HandEndKind = z.infer<typeof handEndKindSchema>;
export type HandResultPayload = z.infer<typeof HandResultPayloadSchema>;
export type StartHandPayload = z.infer<typeof StartHandPayloadSchema>;
export type RequestGameStatePayload = z.infer<typeof RequestGameStatePayloadSchema>;
export type RebuyPayload = z.infer<typeof RebuyPayloadSchema>;
export type RebuyConfirmedPayload = z.infer<typeof RebuyConfirmedPayloadSchema>;
export type SetNextHandReadyPayload = z.infer<typeof SetNextHandReadyPayloadSchema>;
export type NextHandReadyPlayer = z.infer<typeof NextHandReadyPlayerSchema>;
export type NextHandReadyStatePayload = z.infer<
  typeof NextHandReadyStatePayloadSchema
>;
