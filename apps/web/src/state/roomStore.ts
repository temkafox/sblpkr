import type { RoomStatePayload, ServerErrorPayload } from '@neonpoker/shared';
import { create } from 'zustand';

import { ensureRoomStateSettings } from '../lib/roomSettingsForm';

type RoomState = {
  roomState: RoomStatePayload | null;
  lastError: ServerErrorPayload | null;
  setRoomState: (state: RoomStatePayload) => void;
  setError: (error: ServerErrorPayload) => void;
  clearLastError: () => void;
  clearRoomState: () => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  roomState: null,
  lastError: null,
  setRoomState: (roomState) =>
    set({ roomState: ensureRoomStateSettings(roomState), lastError: null }),
  setError: (lastError) => set({ lastError }),
  clearLastError: () => set({ lastError: null }),
  clearRoomState: () => set({ roomState: null, lastError: null }),
}));
