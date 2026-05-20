import type { PlayerMock } from '../../mocks/tableMock';

export interface AvatarProps {
  player: PlayerMock;
  /** Override seat ring color (hero locks cyan in design). */
  ring?: PlayerMock['ring'];
  sizePx?: number;
}

export function Avatar({ player, ring, sizePx }: AvatarProps) {
  const ringCls = `ring-${ring ?? player.ring}`;
  const style = sizePx ? { width: sizePx, height: sizePx } : undefined;

  return (
    <div className={`avatar ${ringCls}`} style={style}>
      {player.avatar ? (
        <img src={player.avatar} alt="" />
      ) : (
        <div className="placeholder">{player.init}</div>
      )}
    </div>
  );
}
