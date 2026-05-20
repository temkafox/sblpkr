import { CardBack } from '../cards/CardBack';
import { CardFace } from '../cards/CardFace';
import type { CardModel } from '../../mocks/tableMock';

export interface OppHolesProps {
  folded?: boolean;
  /** Face-up cards after showdown; when set, backcards are not shown. */
  revealedCards?: readonly CardModel[] | null;
}

/** Opponent hole cards above seat — backs during play, faces after showdown reveal. */
export function OppHoles({ folded, revealedCards }: OppHolesProps) {
  const revealed =
    revealedCards != null && revealedCards.length >= 2
      ? [revealedCards[0]!, revealedCards[1]!]
      : null;

  return (
    <div
      className={`np-opp-holes side-top${folded ? ' np-opp-holes--folded' : ''}${revealed ? ' np-opp-holes--revealed' : ''}`}
    >
      {revealed ? (
        <>
          <CardFace rank={revealed[0].r} suit={revealed[0].s} flipped />
          <CardFace rank={revealed[1].r} suit={revealed[1].s} flipped />
        </>
      ) : (
        <>
          <CardBack size="mini" />
          <CardBack size="mini" />
        </>
      )}
    </div>
  );
}
