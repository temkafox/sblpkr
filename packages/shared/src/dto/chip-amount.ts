import { z } from 'zod';

/** MVP chip amounts are whole integers only — no fractional dollars. */
export const ChipAmountSchema = z.number().int().nonnegative();
