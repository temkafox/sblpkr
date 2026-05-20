import './Sidebar.css';

import type { GameInfoMock } from '../../mocks/tableMock';

export interface GameInfoPanelProps {
  info: GameInfoMock;
}

export function GameInfoPanel({ info }: GameInfoPanelProps) {
  return (
    <div className="np-panel np-game-info">
      <div className="np-panel-head np-panel-head--compact">
        <h3>GAME INFO</h3>
      </div>
      <div className="np-gi-body">
        <div className="np-gi-row">
          <span>Game Type</span>
          <span className="np-gi-val">{info.gameType}</span>
        </div>
        <div className="np-gi-row">
          <span>Stakes</span>
          <span className="np-gi-val">{info.stakes}</span>
        </div>
        <div className="np-gi-row">
          <span>Buy-in</span>
          <span className="np-gi-val">{info.buyIn}</span>
        </div>
        <div className="np-gi-row">
          <span>Players</span>
          <span className="np-gi-val">
            {info.playerCount} / {info.maxSeats}
          </span>
        </div>
        <div className="np-gi-row">
          <span>Next Break</span>
          <span className="np-gi-val">{info.nextBreak}</span>
        </div>
      </div>
    </div>
  );
}
