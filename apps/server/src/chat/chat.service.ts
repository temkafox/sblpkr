import { Injectable } from '@nestjs/common';
import type { ChatMessage, ChatMessagesPayload } from '@neonpoker/shared';
import { randomUUID } from 'node:crypto';

export type ChatAuthor = {
  readonly playerId: string;
  readonly nickname: string;
};

const MAX_MESSAGES_PER_ROOM = 100;

type RoomChatState = {
  messages: ChatMessage[];
  nextSequence: number;
};

@Injectable()
export class ChatService {
  private readonly byRoom = new Map<string, RoomChatState>();

  addMessage(roomId: string, player: ChatAuthor, text: string): ChatMessagesPayload {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error('Message cannot be empty');
    }

    const state = this.getOrCreateRoomState(roomId);
    const sequence = state.nextSequence;
    state.nextSequence += 1;

    const message: ChatMessage = {
      id: randomUUID(),
      roomId,
      playerId: player.playerId,
      nickname: player.nickname,
      text: trimmed,
      sequence,
      createdAt: new Date().toISOString(),
    };

    state.messages.push(message);
    if (state.messages.length > MAX_MESSAGES_PER_ROOM) {
      state.messages.splice(0, state.messages.length - MAX_MESSAGES_PER_ROOM);
    }

    return this.toPayload(roomId, state.messages);
  }

  getMessages(roomId: string): ChatMessagesPayload {
    const state = this.byRoom.get(roomId);
    return this.toPayload(roomId, state?.messages ?? []);
  }

  clearRoom(roomId: string): void {
    this.byRoom.delete(roomId);
  }

  private getOrCreateRoomState(roomId: string): RoomChatState {
    let state = this.byRoom.get(roomId);
    if (state == null) {
      state = { messages: [], nextSequence: 1 };
      this.byRoom.set(roomId, state);
    }
    return state;
  }

  private toPayload(roomId: string, messages: ChatMessage[]): ChatMessagesPayload {
    return { roomId, messages: [...messages] };
  }
}
