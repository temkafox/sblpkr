import './Cards.css';

import type { Suit } from '../../mocks/tableMock';

const SUIT_CHAR: Record<Suit, string> = {
  h: '♥',
  d: '♦',
  s: '♠',
  c: '♣',
};

const SUIT_RED: Record<Suit, boolean> = {
  h: true,
  d: true,
  s: false,
  c: false,
};

export interface CardFaceProps {
  rank: string;
  suit: Suit;
  size?: 'board' | 'hero';
  flipped?: boolean;
}

export function CardFace({ rank, suit, flipped = true }: CardFaceProps) {
  const red = SUIT_RED[suit];
  const suitChar = SUIT_CHAR[suit];

  return (
    <div
      className={['np-card-face', red ? 'np-card-face--red' : '', flipped ? 'np-card-face--flipped' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="np-card-rank">{rank}</div>
      <div className="np-card-suit">{suitChar}</div>
      <div className="np-card-suit-big">{suitChar}</div>
    </div>
  );
}
