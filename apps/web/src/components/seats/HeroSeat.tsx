import './Seats.css';

import { HeroHoleCards } from '../cards/HeroHoleCards';
import { Avatar } from './Avatar';
import { actionTimerBarStyle } from '../../lib/actionTimerDisplay';
import { formatChips } from '../../lib/formatChips';
import { seatStatusLabel } from '../../lib/seatStatusLabel';
import type { SeatPosition } from '../../lib/layout';
import type { CardModel, PlayerMock, SeatStateMock } from '../../mocks/tableMock';

function heroStateClass(status: SeatStateMock['status']) {
  switch (status) {
    case 'turn':
      return 'state-active';
    case 'fold':
      return 'state-folded';
    case 'allin':
      return 'state-allin';
    case 'winner':
      return 'state-winner';
    case 'away':
      return 'state-away';
    default:
      return '';
  }
}

function heroStatusClass(status: SeatStateMock['status']) {
  switch (status) {
    case 'turn':
      return 't-turn';
    case 'fold':
      return 't-fold';
    case 'check':
      return 't-check';
    case 'call':
      return 't-call';
    case 'raise':
      return 't-raise';
    case 'allin':
      return 't-allin';
    case 'winner':
      return 't-winner';
    case 'sitout':
    case 'busted':
    case 'away':
    case 'next_hand':
    case 'waiting':
      return 't-away';
    case 'post_sb':
    case 'post_bb':
      return 't-check';
    default:
      return 't-idle';
  }
}

function heroStatusText(st: SeatStateMock): string {
  return seatStatusLabel(st);
}

export interface HeroSeatProps {
  player: PlayerMock;
  state: SeatStateMock;
  position: SeatPosition;
  holeCards?: [CardModel, CardModel] | null;
  showRebuy?: boolean;
  rebuyAmount?: number;
  rebuyDisabled?: boolean;
  onRebuy?: () => void;
}

export function HeroSeat({
  player,
  state: st,
  position: pos,
  holeCards,
  showRebuy = false,
  rebuyAmount = 200,
  rebuyDisabled = false,
  onRebuy,
}: HeroSeatProps) {
  const w = pos.w || 320;
  const h = pos.h || 110;
  const states = heroStateClass(st.status);
  const timerBarStyle = actionTimerBarStyle(st.actionDeadlineAt);

  return (
    <div
      className={`seat hero ${states}${showRebuy ? ' seat--has-rebuy' : ''}`}
      style={{ left: pos.x, top: pos.y, width: w, height: h }}
    >
      {holeCards ? <HeroHoleCards cards={holeCards} /> : null}
      <div className="body">
        <div className="body-inner">
          <div className="name">{player.name}</div>
          <div className="stack">${formatChips(player.stack)}</div>
          <div className={`status ${heroStatusClass(st.status)}`}>{heroStatusText(st)}</div>
        </div>
        {showRebuy ? (
          <button
            type="button"
            className="seat-rebuy-btn"
            onClick={onRebuy}
            disabled={rebuyDisabled}
          >
            Rebuy ${formatChips(rebuyAmount)}
          </button>
        ) : null}
        <div className="timer">
          <div
            className="bar"
            key={`${player.id}-${st.actionDeadlineAt ?? st.status}`}
            style={timerBarStyle}
          />
        </div>
      </div>
      <Avatar player={player} ring="cyan" />
      {st.status === 'winner' ? <div className="winner-tag">HAND WINNER</div> : null}
    </div>
  );
}
