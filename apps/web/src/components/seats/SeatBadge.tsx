export interface SeatBadgeProps {
  kind: 'd' | 'sb' | 'bb';
  x: number;
  y: number;
}

export function SeatBadge({ kind, x, y }: SeatBadgeProps) {
  const label = kind === 'd' ? 'D' : kind.toUpperCase();
  return (
    <div className={`seat-badge ${kind}`} style={{ left: x, top: y }}>
      {label}
    </div>
  );
}
