import type { HandResultPayload, PlayerGameState } from '@neonpoker/shared';
import { create } from 'zustand';

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
  clearGameState: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  gameState: null,
  handResult: null,
  isGameLoading: false,
  isSubmittingAction: false,
  gameError: null,
  setGameState: (gameState) =>
    set({
      gameState,
      isGameLoading: false,
      isSubmittingAction: false,
      gameError: null,
    }),
  setHandResult: (handResult) => set({ handResult }),
  setGameLoading: (isGameLoading) => set({ isGameLoading }),
  setSubmittingAction: (isSubmittingAction) => set({ isSubmittingAction }),
  setGameError: (gameError) =>
    set({ gameError, isSubmittingAction: false }),
  clearGameState: () =>
    set({
      gameState: null,
      handResult: null,
      isGameLoading: false,
      isSubmittingAction: false,
      gameError: null,
    }),
}));
