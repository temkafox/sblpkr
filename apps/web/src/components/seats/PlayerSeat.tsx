import './Seats.css';

import { Avatar } from './Avatar';
import { OppHoles } from './OppHoles';
import type { SeatPosition } from '../../lib/layout';
import type { PlayerMock, SeatStateMock } from '../../mocks/tableMock';

function opponentStateClass(status: SeatStateMock['status']) {
  switch (status) {
    case 'turn':
      return 'state-active';
    case 'fold':
      return 'state-folded';
    case 'allin':
      return 'state-allin';
    case 'winner':
      return 'state-winner';
    case 'sitout':
      return 'state-sitout';
    default:
      return '';
  }
}

function opponentStatusClass(status: SeatStateMock['status']) {
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
      return 't-sitout';
    default:
      return 't-idle';
  }
}

function opponentStatusText(st: SeatStateMock): string {
  switch (st.status) {
    case 'turn':
      return 'YOUR TURN';
    case 'fold':
      return 'FOLD';
    case 'check':
      return 'CHECK';
    case 'call':
      return st.bet ? `CALL $${st.bet}` : 'CALL';
    case 'raise':
      return `RAISE TO $${st.bet || 0}`;
    case 'allin':
      return 'ALL-IN';
    case 'winner':
      return 'WINNER';
    case 'sitout':
      return 'SITTING OUT';
    case 'waiting':
      return '';
    default:
      return '';
  }
}

export interface PlayerSeatProps {
  player: PlayerMock;
  state: SeatStateMock;
  position: SeatPosition;
  showHoles: boolean;
}

export function PlayerSeat({ player, state: st, position: pos, showHoles }: PlayerSeatProps) {
  const w = pos.w || 244;
  const h = pos.h || 84;
  const states = opponentStateClass(st.status);

  return (
    <div className={`seat ${states}`} style={{ left: pos.x, top: pos.y, width: w, height: h }}>
      {showHoles ? <OppHoles folded={st.status === 'fold'} /> : null}
      <div className="body">
        <div className="body-inner">
          <div className="name">{player.name}</div>
          <div className="stack">${player.stack.toFixed(2)}</div>
          <div className={`status ${opponentStatusClass(st.status)}`}>{opponentStatusText(st)}</div>
        </div>
        <div className="timer">
          <div className="bar" key={`${player.id}-${st.status}`} />
        </div>
      </div>
      <Avatar player={player} />
      {st.status === 'winner' ? <div className="winner-tag">WINNER</div> : null}
    </div>
  );
}
