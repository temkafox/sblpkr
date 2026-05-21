import { z } from 'zod';

import { RoomIdOrCodeParamSchema } from './room.dto';

const CHAT_TEXT_MAX = 200;

export const SendChatMessagePayloadSchema = z.object({
  roomId: RoomIdOrCodeParamSchema,
  text: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(CHAT_TEXT_MAX, `Message must be at most ${CHAT_TEXT_MAX} characters`),
});

export type SendChatMessagePayload = z.infer<typeof SendChatMessagePayloadSchema>;

export const RequestChatMessagesPayloadSchema = z.object({
  roomId: RoomIdOrCodeParamSchema,
});

export type RequestChatMessagesPayload = z.infer<
  typeof RequestChatMessagesPayloadSchema
>;

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  playerId: z.string().min(1),
  nickname: z.string().min(1),
  text: z.string().min(1).max(CHAT_TEXT_MAX),
  sequence: z.number().int().positive(),
  createdAt: z.string().min(1),
});

export const ChatMessagesPayloadSchema = z.object({
  roomId: z.string().min(1),
  messages: z.array(ChatMessageSchema),
});

export type ChatMessagesPayload = z.infer<typeof ChatMessagesPayloadSchema>;

export const CHAT_MESSAGE_MAX_LENGTH = CHAT_TEXT_MAX;
