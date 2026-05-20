import { z } from 'zod';

export const ChatMessagePayloadSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export type ChatMessagePayload = z.infer<typeof ChatMessagePayloadSchema>;
