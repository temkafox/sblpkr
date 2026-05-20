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
});

export const PlayerGameStateSchema = PublicGameStateSchema.extend({
  availableActions: availableActionsSchema.optional(),
});

export const HandResultPayloadSchema = z.object({
  handId: z.string().min(1),
  winnerSeatIndexes: z.array(z.number().int().nonnegative()),
});

export const StartHandPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export const RequestGameStatePayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export type WireSeatView = z.infer<typeof WireSeatViewSchema>;
export type PublicGameState = z.infer<typeof PublicGameStateSchema>;
export type PlayerGameState = z.infer<typeof PlayerGameStateSchema>;
export type HandResultPayload = z.infer<typeof HandResultPayloadSchema>;
export type StartHandPayload = z.infer<typeof StartHandPayloadSchema>;
export type RequestGameStatePayload = z.infer<typeof RequestGameStatePayloadSchema>;
