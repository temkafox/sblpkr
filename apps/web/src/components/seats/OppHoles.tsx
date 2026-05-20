import { CardBack } from '../cards/CardBack';

export interface OppHolesProps {
  folded?: boolean;
}

/** Two face-down hole cards centered above opponent seat — production rule: always top. */
export function OppHoles({ folded }: OppHolesProps) {
  return (
    <div className={`np-opp-holes side-top${folded ? ' np-opp-holes--folded' : ''}`}>
      <CardBack size="mini" />
      <CardBack size="mini" />
    </div>
  );
}
