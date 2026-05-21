import type {
  HandHistoryPayload,
  HandResultPayload,
  NextHandReadyStatePayload,
  PlayerGameState,
} from '@neonpoker/shared';
import { create } from 'zustand';

import { handHistoryStreetsFromPayload } from '../lib/handHistoryAdapter';
import type { HandHistoryStreet } from '../mocks/tableMock';

function shouldClearHandResultOnGameState(
  previous: PlayerGameState | null,
  next: PlayerGameState,
): boolean {
  if (next.handId == null || next.handId.length === 0) {
    return true;
  }
  if (!next.handComplete && previous?.handId !== next.handId) {
    return true;
  }
  return false;
}

type GameState = {
  gameState: PlayerGameState | null;
  handResult: HandResultPayload | null;
  nextHandReadyState: NextHandReadyStatePayload | null;
  handHistory: HandHistoryStreet[];
  handHistoryRevision: number | null;
  isGameLoading: boolean;
  isSubmittingAction: boolean;
  gameError: string | null;
  setGameState: (state: PlayerGameState) => void;
  setHandResult: (result: HandResultPayload) => void;
  setNextHandReadyState: (state: NextHandReadyStatePayload) => void;
  setHandHistory: (payload: HandHistoryPayload) => void;
  setGameLoading: (loading: boolean) => void;
  setSubmittingAction: (submitting: boolean) => void;
  setGameError: (message: string | null) => void;
  clearHandResult: () => void;
  clearHandHistory: () => void;
  clearGameState: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  gameState: null,
  handResult: null,
  nextHandReadyState: null,
  handHistory: [],
  handHistoryRevision: null,
  isGameLoading: false,
  isSubmittingAction: false,
  gameError: null,
  setGameState: (gameState) =>
    set((prev) => ({
      gameState,
      handResult: shouldClearHandResultOnGameState(prev.gameState, gameState)
        ? null
        : prev.handResult,
      isGameLoading: false,
      isSubmittingAction: false,
      gameError: null,
    })),
  setHandResult: (handResult) => set({ handResult }),
  setNextHandReadyState: (nextHandReadyState) => set({ nextHandReadyState }),
  setHandHistory: (payload) =>
    set((prev) => {
      if (
        prev.handHistoryRevision != null &&
        prev.handHistoryRevision === payload.revision
      ) {
        return prev;
      }
      return {
        handHistory: handHistoryStreetsFromPayload(payload),
        handHistoryRevision: payload.revision,
      };
    }),
  setGameLoading: (isGameLoading) => set({ isGameLoading }),
  setSubmittingAction: (isSubmittingAction) => set({ isSubmittingAction }),
  setGameError: (gameError) =>
    set({ gameError, isSubmittingAction: false }),
  clearHandResult: () => set({ handResult: null }),
  clearHandHistory: () =>
    set({ handHistory: [], handHistoryRevision: null }),
  clearGameState: () =>
    set({
      gameState: null,
      handResult: null,
      nextHandReadyState: null,
      handHistory: [],
      handHistoryRevision: null,
      isGameLoading: false,
      isSubmittingAction: false,
      gameError: null,
    }),
}));
