import './Seats.css';

import { Fragment } from 'react';

import { betOffset, badgeOffset, type SeatPosition } from '../../lib/layout';
import { chipFor } from '../../lib/chips';
import type { CardModel, MockGameState, PlayerMock, SeatStateMock } from '../../mocks/tableMock';
import { BetChip } from './BetChip';
import { HeroSeat } from './HeroSeat';
import { PlayerSeat } from './PlayerSeat';
import { SeatBadge } from './SeatBadge';

export interface SeatLayerProps {
  layout: SeatPosition[];
  playersBySeatIndex: PlayerMock[];
  seatStatesBySeatIndex: SeatStateMock[];
  gameState: MockGameState;
  /** When false, hides blinds/button badges, bet chips, and opponent holes. */
  handActive?: boolean;
  heroHoleCards?: [CardModel, CardModel] | null;
  showHeroRebuy?: boolean;
  heroRebuyAmount?: number;
  heroRebuyDisabled?: boolean;
  onHeroRebuy?: () => void;
}

/** Blind/button badges — driven only by mock indices (no blind math in UI). */
export function badgeKindForSeat(seatIndex: number, gs: MockGameState): 'd' | 'sb' | 'bb' | null {
  const { seats, dealerSeatIndex, smallBlindSeatIndex, bigBlindSeatIndex } = gs;
  if (seatIndex === dealerSeatIndex) return 'd';
  if (seats !== 2 && seatIndex === smallBlindSeatIndex) return 'sb';
  if (seatIndex === bigBlindSeatIndex) return 'bb';
  return null;
}

export function SeatLayer({
  layout,
  playersBySeatIndex,
  seatStatesBySeatIndex,
  gameState,
  handActive = true,
  heroHoleCards = null,
  showHeroRebuy = false,
  heroRebuyAmount = 200,
  heroRebuyDisabled = false,
  onHeroRebuy,
}: SeatLayerProps) {
  const showBadges = handActive;
  const showBets = handActive;
  const showOppHoles = handActive;

  return (
    <div className="np-seat-layer">
      {layout.map((pos, seatIndex) => {
        const player = playersBySeatIndex[seatIndex];
        const st = seatStatesBySeatIndex[seatIndex];
        const w = pos.w ?? 244;
        const h = pos.h ?? 84;

        const showOpp =
          showOppHoles &&
          !pos.hero &&
          st.status !== 'sitout' &&
          ((st.showOppBackcards ?? false) ||
            (st.oppHoleCards != null && st.oppHoleCards.length >= 2));

        const showBet = showBets && st.bet > 0;
        const bo = betOffset(pos.dir, w, h);

        const badgeKind = showBadges ? badgeKindForSeat(seatIndex, gameState) : null;
        const boBadge = badgeKind ? badgeOffset(pos.dir, w, h) : null;

        return (
          <Fragment key={pos.id}>
            {pos.hero ? (
              <HeroSeat
                player={player}
                state={st}
                position={pos}
                holeCards={heroHoleCards}
                showRebuy={showHeroRebuy}
                rebuyAmount={heroRebuyAmount}
                rebuyDisabled={heroRebuyDisabled}
                onRebuy={onHeroRebuy}
              />
            ) : (
              <PlayerSeat
                player={player}
                state={st}
                position={pos}
                showHoles={showOpp}
              />
            )}

            {badgeKind && boBadge ? (
              <SeatBadge kind={badgeKind} x={pos.x + boBadge.dx} y={pos.y + boBadge.dy} />
            ) : null}

            {showBet ? (
              <BetChip
                x={pos.x + bo.dx}
                y={pos.y + bo.dy}
                amount={st.bet}
                chip={chipFor(st.bet)}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}