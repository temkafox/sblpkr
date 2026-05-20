import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SessionPayload = {
  nickname: string;
  roomId: string;
};

type SessionState = {
  nickname: string | null;
  roomId: string | null;
  setSession: (payload: SessionPayload) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      nickname: null,
      roomId: null,
      setSession: ({ nickname, roomId }) => set({ nickname, roomId }),
      clearSession: () => set({ nickname: null, roomId: null }),
    }),
    {
      name: 'neonpoker:session',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ nickname: s.nickname, roomId: s.roomId }),
      skipHydration: Boolean(import.meta.env.VITEST),
    },
  ),
);
