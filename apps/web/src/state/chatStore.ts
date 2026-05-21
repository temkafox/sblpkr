import type { ChatMessage } from '@neonpoker/shared';
import { create } from 'zustand';

type ChatStoreState = {
  chatMessages: ChatMessage[];
  chatError: string | null;
  setChatMessages: (messages: ChatMessage[]) => void;
  clearChatMessages: () => void;
  setChatError: (error: string | null) => void;
};

export const useChatStore = create<ChatStoreState>((set) => ({
  chatMessages: [],
  chatError: null,
  setChatMessages: (chatMessages) => set({ chatMessages, chatError: null }),
  clearChatMessages: () => set({ chatMessages: [], chatError: null }),
  setChatError: (chatError) => set({ chatError }),
}));
