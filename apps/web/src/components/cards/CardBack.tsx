import './Cards.css';

export interface CardBackProps {
  size?: 'board' | 'mini';
}

export function CardBack({ size = 'board' }: CardBackProps) {
  const cls = size === 'mini' ? 'np-card-back np-card-back--mini' : 'np-card-back';

  return <div className={cls} aria-hidden />;
}
