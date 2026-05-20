/** Sidebar chat row — mirrors Hand History name coloring via `cls`. */

export type ChatMessage = {
  readonly who: string;
  readonly cls: string;
  readonly msg: string;
};
