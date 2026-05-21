import './Sidebar.css';

import type { NextHandReadyStatePayload } from '@neonpoker/shared';

export interface NextHandPanelProps {
  readyState: NextHandReadyStatePayload;
}

export function NextHandPanel({ readyState }: NextHandPanelProps) {
  if (readyState.requiredCount === 0) {
    return null;
  }

  return (
    <div className="np-panel np-next-hand">
      <div className="np-panel-head np-panel-head--compact">
        <h3>NEXT HAND</h3>
        <span className="np-nh-count">
          {readyState.readyCount}/{readyState.requiredCount}
        </span>
      </div>
      <ul className="np-nh-list" aria-label="Next hand ready players">
        {readyState.eligiblePlayers.map((player) => (
          <li
            key={player.playerId}
            className={
              player.isReady ? 'np-nh-row np-nh-row--ready' : 'np-nh-row np-nh-row--waiting'
            }
          >
            <span className="np-nh-icon" aria-hidden>
              {player.isReady ? '✅' : '⏳'}
            </span>
            <span className="np-nh-name">{player.nickname}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
