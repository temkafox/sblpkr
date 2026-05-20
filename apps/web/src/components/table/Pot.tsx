import './Pot.css';

import { formatChips } from '../../lib/formatChips';

export interface PotProps {
  amount: number;
  showChips?: boolean;
}

export function Pot({ amount, showChips = true }: PotProps) {
  return (
    <div className="np-pot">
      <div className="np-pot-lbl">Total Pot</div>
      <div className="np-pot-amt">${formatChips(amount)}</div>
      {showChips ? (
        <div className="np-pot-chip-row">
          <img src="/assets/green-chip.png" alt="" />
          <img src="/assets/purple-chip.png" alt="" />
          <img src="/assets/blue-chip.png" alt="" />
        </div>
      ) : null}
    </div>
  );
}
