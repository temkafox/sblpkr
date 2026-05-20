import './TablePage.css';

import { useParams } from 'react-router-dom';

import { ActionBar } from '../../components/action-bar/ActionBar';
import { useSessionStore } from '../../state/sessionStore';
import { BoardCards } from '../../components/cards/BoardCards';
import { HeroHoleCards } from '../../components/cards/HeroHoleCards';
import { SeatLayer } from '../../components/seats/SeatLayer';
import { Pot } from '../../components/table/Pot';
import { TableSurface } from '../../components/table/TableSurface';
import { RightSidebar } from '../../components/sidebar/RightSidebar';
import { TABLE_PAGE_MOCK } from '../../mocks/tableMock';

export function TablePage() {
  const { roomId } = useParams<{ roomId: string }>();
  void roomId;

  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const m = TABLE_PAGE_MOCK;

  const statusLabel =
    connectionStatus === 'connecting'
      ? 'Connecting to room…'
      : connectionStatus === 'error'
        ? 'Connection issue — check join page'
        : null;

  return (
    <div className="table-page">
      {statusLabel ? (
        <p className="table-page__status" aria-live="polite">
          {statusLabel}
        </p>
      ) : null}
      <TableSurface />
      <Pot amount={m.potAmount} showChips={m.showPotChips} />
      <BoardCards cards={m.boardCards} reveal={m.boardReveal} />
      <HeroHoleCards cards={m.heroHoleCards} />
      <SeatLayer
        layout={m.layout}
        playersBySeatIndex={m.playersBySeatIndex}
        seatStatesBySeatIndex={m.seatStatesBySeatIndex}
        gameState={m.gameState}
      />
      <ActionBar mock={m.actionBar} />
      <RightSidebar
        handHistory={m.handHistory}
        chatMessages={m.chatMessages}
        gameInfo={m.gameInfo}
      />
    </div>
  );
}
