import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error';

export type SessionPayload = {
  nickname: string;
  roomId: string;
};

type SessionState = {
  nickname: string | null;
  roomId: string | null;
  connectionStatus: ConnectionStatus;
  setSession: (payload: SessionPayload) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      nickname: null,
      roomId: null,
      connectionStatus: 'idle',
      setSession: ({ nickname, roomId }) =>
        set({ nickname, roomId, connectionStatus: 'connected' }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      clearSession: () =>
        set({
          nickname: null,
          roomId: null,
          connectionStatus: 'idle',
        }),
    }),
    {
      name: 'neonpoker:session',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ nickname: s.nickname, roomId: s.roomId }),
      skipHydration: Boolean(import.meta.env.VITEST),
    },
  ),
);
