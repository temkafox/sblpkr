/** Playing card — wire/UI friendly encoding (matches components-map shorthand). */

export type Suit = 'h' | 'd' | 's' | 'c';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export type Card = {
  readonly r: Rank;
  readonly s: Suit;
};
