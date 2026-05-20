import { Logger } from '@nestjs/common';
import type { CoreGameState, ShowdownResult } from '@neonpoker/poker-core';
import {
  buildShowdownCardPool,
  evaluateBestHand,
  getPlayerAtSeat,
} from '@neonpoker/poker-core';

import type { MutableInternalRoom } from '../room/room.types';

import { isShowdownDebugEnabled } from './showdown-debug-config';

const logger = new Logger('Showdown');

function formatCard(card: { readonly r: string; readonly s: string }): string {
  return `${card.r}${card.s}`;
}

function nicknameForSeat(
  room: MutableInternalRoom | null,
  seatIndex: number,
): string {
  const member = room?.players.find((p) => p.seatIndex === seatIndex);
  return member?.nickname ?? `seat-${seatIndex}`;
}

/** Structured showdown audit log — board, hole cards, ranks, winners, awards. */
export function logShowdownResolution(
  state: CoreGameState,
  result: ShowdownResult,
  room: MutableInternalRoom | null,
): void {
  if (!isShowdownDebugEnabled()) {
    return;
  }

  const hand = state.hand;
  if (hand == null) {
    return;
  }

  const board = hand.boardCards.map(formatCard).join(' ');
  logger.log(`showdown board: ${board}`);

  for (const seat of state.table.seats) {
    const player = getPlayerAtSeat(state, seat.seatIndex);
    if (player == null || player.hasFolded) {
      continue;
    }
    const hole = player.holeCards.map(formatCard).join(' ');
    const evaluated = result.evaluatedHandsBySeatIndex[seat.seatIndex];
    if (player.holeCards.length !== 2) {
      logger.warn(
        `showdown player ${nicknameForSeat(room, seat.seatIndex)} (${player.playerId}) missing hole cards at resolve`,
      );
      continue;
    }
    const seven = buildShowdownCardPool(player.holeCards, hand.boardCards);
    const ev = evaluated ?? evaluateBestHand(seven);
    logger.log(
      [
        `showdown player ${nicknameForSeat(room, seat.seatIndex)}`,
        `playerId=${player.playerId}`,
        `hole=${hole}`,
        `rank=${ev.label ?? ev.category}`,
        `best5=${ev.cards.map(formatCard).join(' ')}`,
        `tiebreakers=${ev.tiebreakers.join(',')}`,
      ].join(' | '),
    );
  }

  const winnerIds = result.winners.map(
    (seat) => getPlayerAtSeat(state, seat)?.playerId ?? `seat-${seat}`,
  );
  logger.log(`showdown winnerIds: ${winnerIds.join(', ') || '(none)'}`);

  const awards: string[] = [];
  for (const pr of result.potResults) {
    for (const [seatKey, amount] of Object.entries(pr.awardedAmountsBySeatIndex)) {
      if (amount == null || amount <= 0) continue;
      const seat = Number(seatKey);
      awards.push(`${nicknameForSeat(room, seat)}=$${amount}`);
    }
  }
  logger.log(`showdown awarded: ${awards.join(', ') || '(none)'}`);
}
