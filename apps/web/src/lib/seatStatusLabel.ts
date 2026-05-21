import { formatChips } from './formatChips';
import type { SeatStateMock } from '../mocks/tableMock';

/** HUD label for a seat status token (viewer-relative table). */
export function seatStatusLabel(st: Pick<SeatStateMock, 'status' | 'bet'>): string {
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
    case 'away':
      return 'AWAY';
    case 'post_sb':
      return st.bet ? `SB $${formatChips(st.bet)}` : 'SB';
    case 'post_bb':
      return st.bet ? `BB $${formatChips(st.bet)}` : 'BB';
    case 'next_hand':
      return 'NEXT HAND';
    case 'waiting':
      return 'WAITING';
    default:
      return '';
  }
}
