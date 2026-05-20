import './Cards.css';

import { CardFace } from './CardFace';
import type { CardModel } from '../../mocks/tableMock';

export interface HeroHoleCardsProps {
  cards: [CardModel, CardModel];
}

export function HeroHoleCards({ cards }: HeroHoleCardsProps) {
  return (
    <div className="np-hero-holes">
      {cards.map((card, index) => (
        <CardFace key={index} rank={card.r} suit={card.s} size="hero" flipped />
      ))}
    </div>
  );
}
