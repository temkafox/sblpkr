import './Cards.css';

import { CardBack } from './CardBack';
import { CardFace } from './CardFace';
import type { BoardReveal, CardModel } from '../../mocks/tableMock';

export interface BoardCardsProps {
  cards: CardModel[];
  reveal: BoardReveal;
}

const SLOT_INDICES = [0, 1, 2, 3, 4] as const;

export function BoardCards({ cards, reveal }: BoardCardsProps) {
  return (
    <div className="np-board">
      {SLOT_INDICES.map((i) => {
        const card = cards[i];
        const open = i < reveal && card !== undefined;
        return (
          <div className="np-board-slot" key={i}>
            {open ? <CardFace rank={card.r} suit={card.s} flipped /> : <CardBack size="board" />}
          </div>
        );
      })}
    </div>
  );
}
