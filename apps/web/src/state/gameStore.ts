import type { HandResultPayload, PlayerGameState } from '@neonpoker/shared';
import { create } from 'zustand';

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
  isGameLoading: boolean;
  isSubmittingAction: boolean;
  gameError: string | null;
  setGameState: (state: PlayerGameState) => void;
  setHandResult: (result: HandResultPayload) => void;
  setGameLoading: (loading: boolean) => void;
  setSubmittingAction: (submitting: boolean) => void;
  setGameError: (message: string | null) => void;
  clearHandResult: () => void;
  clearGameState: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  gameState: null,
  handResult: null,
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
  setGameLoading: (isGameLoading) => set({ isGameLoading }),
  setSubmittingAction: (isSubmittingAction) => set({ isSubmittingAction }),
  setGameError: (gameError) =>
    set({ gameError, isSubmittingAction: false }),
  clearHandResult: () => set({ handResult: null }),
  clearGameState: () =>
    set({
      gameState: null,
      handResult: null,
      isGameLoading: false,
      isSubmittingAction: false,
      gameError: null,
    }),
}));
