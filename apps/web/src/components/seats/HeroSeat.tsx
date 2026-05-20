import './Seats.css';

import { Avatar } from './Avatar';
import { formatChips } from '../../lib/formatChips';
import type { SeatPosition } from '../../lib/layout';
import type { PlayerMock, SeatStateMock } from '../../mocks/tableMock';

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
      return 't-sitout';
    case 'post_sb':
    case 'post_bb':
      return 't-check';
    default:
      return 't-idle';
  }
}

function heroStatusText(st: SeatStateMock): string {
  switch (st.status) {
    case 'turn':
      return 'YOUR TURN';
    case 'fold':
      return 'FOLD';
    case 'check':
      return 'CHECK';
    case 'call':
      return st.bet ? `CALL $${formatChips(st.bet)}` : 'CALL';
    case 'raise':
      return `RAISE TO $${formatChips(st.bet || 0)}`;
    case 'allin':
      return 'ALL-IN';
    case 'winner':
      return 'WINNER';
    case 'sitout':
      return 'SITTING OUT';
    case 'busted':
      return 'BUSTED';
    case 'post_sb':
      return st.bet ? `SB $${formatChips(st.bet)}` : 'SB';
    case 'post_bb':
      return st.bet ? `BB $${formatChips(st.bet)}` : 'BB';
    case 'waiting':
      return '';
    default:
      return '';
  }
}

export interface HeroSeatProps {
  player: PlayerMock;
  state: SeatStateMock;
  position: SeatPosition;
}

export function HeroSeat({ player, state: st, position: pos }: HeroSeatProps) {
  const w = pos.w || 320;
  const h = pos.h || 110;
  const states = heroStateClass(st.status);

  return (
    <div className={`seat hero ${states}`} style={{ left: pos.x, top: pos.y, width: w, height: h }}>
      <div className="body">
        <div className="body-inner">
          <div className="name">{player.name}</div>
          <div className="stack">${formatChips(player.stack)}</div>
          <div className={`status ${heroStatusClass(st.status)}`}>{heroStatusText(st)}</div>
        </div>
        <div className="timer">
          <div className="bar" key={`${player.id}-${st.status}`} />
        </div>
      </div>
      <Avatar player={player} ring="cyan" />
      {st.status === 'winner' ? <div className="winner-tag">HAND WINNER</div> : null}
    </div>
  );
}
