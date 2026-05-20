import type { Street } from './game-state';

export type HandHistoryRow = {
  readonly name: string;
  readonly cls: string;
  readonly act: string;
};

export type HandHistoryStreet = {
  readonly street: Street;
  readonly rows: readonly HandHistoryRow[];
};

/** Bundle for replay / persistence boundaries (expand in later phases). */

export type HandHistoryEntry = {
  readonly handId: string;
  readonly handNumber: number;
  readonly streets: readonly HandHistoryStreet[];
};
