import './HandResultBanner.css';

import type { HandResultPayload, PlayerGameState, RoomStatePayload } from '@neonpoker/shared';

import {
  buildHandResultWinnerLines,
  formatAwardedChips,
  handResultHeadline,
} from '../../lib/handResultView';

export interface HandResultBannerProps {
  result: HandResultPayload;
  roomState: RoomStatePayload | null;
  gameState: PlayerGameState | null;
}

export function HandResultBanner({
  result,
  roomState,
  gameState,
}: HandResultBannerProps) {
  const winners = buildHandResultWinnerLines(result, roomState, gameState);
  const headline = handResultHeadline(result);

  return (
    <div className="hand-result-banner" aria-live="polite">
      <p className="hand-result-banner__title">{headline}</p>
      <ul className="hand-result-banner__winners">
        {winners.map((winner) => (
          <li key={winner.seatIndex} className="hand-result-banner__winner">
            <span className="hand-result-banner__name">{winner.nickname}</span>
            <span className="hand-result-banner__amount">
              +{formatAwardedChips(winner.amount)}
            </span>
            {winner.handLabel ? (
              <span className="hand-result-banner__hand">{winner.handLabel}</span>
            ) : result.isFoldWin ? (
              <span className="hand-result-banner__hand">All others folded</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="hand-result-banner__total">
        Total awarded {formatAwardedChips(result.totalAwarded)}
      </p>
    </div>
  );
}
