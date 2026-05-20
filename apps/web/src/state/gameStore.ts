import type { HandResultPayload, PlayerGameState } from '@neonpoker/shared';
import { create } from 'zustand';

type GameState = {
  gameState: PlayerGameState | null;
  handResult: HandResultPayload | null;
  isGameLoading: boolean;
  gameError: string | null;
  setGameState: (state: PlayerGameState) => void;
  setHandResult: (result: HandResultPayload) => void;
  setGameLoading: (loading: boolean) => void;
  setGameError: (message: string | null) => void;
  clearGameState: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  gameState: null,
  handResult: null,
  isGameLoading: false,
  gameError: null,
  setGameState: (gameState) =>
    set({
      gameState,
      isGameLoading: false,
      gameError: null,
    }),
  setHandResult: (handResult) => set({ handResult }),
  setGameLoading: (isGameLoading) => set({ isGameLoading }),
  setGameError: (gameError) => set({ gameError }),
  clearGameState: () =>
    set({
      gameState: null,
      handResult: null,
      isGameLoading: false,
      gameError: null,
    }),
}));
