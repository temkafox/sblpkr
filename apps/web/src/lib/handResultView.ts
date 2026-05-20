import type {
  HandResultPayload,
  PlayerGameState,
  RoomStatePayload,
} from '@neonpoker/shared';

import { formatChips } from './formatChips';

export type HandResultWinnerLine = {
  seatIndex: number;
  nickname: string;
  amount: number;
  handLabel: string | null;
};

function nicknameForSeat(
  seatIndex: number,
  room: RoomStatePayload | null,
  gameState: PlayerGameState | null,
): string {
  const fromGame = gameState?.seats.find((s) => s.seatIndex === seatIndex);
  if (fromGame?.nickname) return fromGame.nickname;

  const fromRoom = room?.players.find((p) => p.seatIndex === seatIndex);
  if (fromRoom?.nickname) return fromRoom.nickname;

  return `Seat ${seatIndex + 1}`;
}

function handLabelForSeat(
  result: HandResultPayload,
  seatIndex: number,
): string | null {
  if (result.isFoldWin) return null;
  if (result.potResults != null) {
    for (const pot of result.potResults) {
      if (pot.winningSeatIndexes.includes(seatIndex)) {
        return pot.winningHandLabel ?? result.winningHandLabel ?? null;
      }
    }
  }
  return result.winningHandLabel ?? null;
}

/** Winner rows for the hand-result banner — uses roster + server awards only. */
export function buildHandResultWinnerLines(
  result: HandResultPayload,
  room: RoomStatePayload | null,
  gameState: PlayerGameState | null,
): HandResultWinnerLine[] {
  const lines: HandResultWinnerLine[] = [];
  const seen = new Set<number>();

  for (const seatIndex of result.winnerSeatIndexes) {
    if (seen.has(seatIndex)) continue;
    seen.add(seatIndex);
    const amount = result.awardedAmountsBySeatIndex[String(seatIndex)] ?? 0;
    if (amount <= 0) continue;
    lines.push({
      seatIndex,
      nickname: nicknameForSeat(seatIndex, room, gameState),
      amount,
      handLabel: handLabelForSeat(result, seatIndex),
    });
  }

  if (lines.length > 0) return lines;

  for (const [seatKey, amount] of Object.entries(
    result.awardedAmountsBySeatIndex,
  )) {
    if (amount <= 0) continue;
    const seatIndex = Number(seatKey);
    lines.push({
      seatIndex,
      nickname: nicknameForSeat(seatIndex, room, gameState),
      amount,
      handLabel: handLabelForSeat(result, seatIndex),
    });
  }

  return lines.sort((a, b) => a.seatIndex - b.seatIndex);
}

export function formatAwardedChips(amount: number): string {
  return `$${formatChips(amount)}`;
}

export function handResultHeadline(result: HandResultPayload): string {
  if (result.isFoldWin) return 'Hand complete — fold win';
  if (result.winnerSeatIndexes.length > 1) return 'Hand complete — split pot';
  return 'Hand complete';
}
