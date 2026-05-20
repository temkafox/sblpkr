import type { ChipTexture } from '../../lib/chips';

export interface BetChipProps {
  x: number;
  y: number;
  amount: number;
  chip: ChipTexture;
}

export function BetChip({ x, y, amount, chip }: BetChipProps) {
  return (
    <div className="bet-chip" style={{ left: x, top: y }}>
      <img src={`/assets/${chip}.png`} alt="" />
      <span className="v">${amount}</span>
    </div>
  );
}
