import type { RoomStatePayload, ServerErrorPayload } from '@neonpoker/shared';
import { create } from 'zustand';

type RoomState = {
  roomState: RoomStatePayload | null;
  lastError: ServerErrorPayload | null;
  setRoomState: (state: RoomStatePayload) => void;
  setError: (error: ServerErrorPayload) => void;
  clearRoomState: () => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  roomState: null,
  lastError: null,
  setRoomState: (roomState) => set({ roomState, lastError: null }),
  setError: (lastError) => set({ lastError }),
  clearRoomState: () => set({ roomState: null, lastError: null }),
}));
