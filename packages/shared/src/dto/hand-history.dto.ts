import { z } from 'zod';

import { ChipAmountSchema } from './chip-amount';

const streetSchema = z.enum([
  'PRE-FLOP',
  'FLOP',
  'TURN',
  'RIVER',
  'SHOWDOWN',
]);

const boardCardSchema = z.object({
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

export const HandHistoryActionKindSchema = z.enum([
  'hand_start',
  'post_sb',
  'post_bb',
  'fold',
  'check',
  'call',
  'raise',
  'allin',
  'street',
  'board',
  'hand_complete',
  'winner',
  'rebuy',
  'timeout_check',
  'timeout_fold',
]);

/** One public hand-history line (no hole cards / deck). */
export const HandHistoryEntrySchema = z.object({
  seq: z.number().int().nonnegative(),
  street: streetSchema,
  text: z.string().min(1),
  nickname: z.string().nullable().optional(),
  nameColor: z.string().min(1).optional(),
  actionKind: HandHistoryActionKindSchema.optional(),
  amount: ChipAmountSchema.optional(),
  boardCards: z.array(boardCardSchema).optional(),
});

export const HandHistoryStreetSectionSchema = z.object({
  street: streetSchema,
  entries: z.array(HandHistoryEntrySchema),
});

export const HandHistoryPayloadSchema = z
  .object({
    roomId: z.string().min(1),
    handId: z.string().nullable(),
    handNumber: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    streets: z.array(HandHistoryStreetSectionSchema),
  })
  .strict();

export const RequestHandHistoryPayloadSchema = z.object({
  roomId: z.string().trim().min(1).max(128),
});

export type HandHistoryActionKind = z.infer<typeof HandHistoryActionKindSchema>;
export type HandHistoryEntry = z.infer<typeof HandHistoryEntrySchema>;
export type HandHistoryStreetSection = z.infer<
  typeof HandHistoryStreetSectionSchema
>;
export type HandHistoryPayload = z.infer<typeof HandHistoryPayloadSchema>;
export type RequestHandHistoryPayload = z.infer<
  typeof RequestHandHistoryPayloadSchema
>;
