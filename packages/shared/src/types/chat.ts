/** Wire-safe table chat message (server-fed snapshot rows). */

export type ChatMessage = {
  readonly id: string;
  readonly roomId: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly text: string;
  readonly sequence: number;
  readonly createdAt: string;
};
