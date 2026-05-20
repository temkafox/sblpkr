import './TablePage.css';

import { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ActionBar } from '../../components/action-bar/ActionBar';
import { BoardCards } from '../../components/cards/BoardCards';
import { HeroHoleCards } from '../../components/cards/HeroHoleCards';
import { SeatLayer } from '../../components/seats/SeatLayer';
import { Pot } from '../../components/table/Pot';
import { TableSurface } from '../../components/table/TableSurface';
import { RightSidebar } from '../../components/sidebar/RightSidebar';
import { adaptPlayerGameState } from '../../lib/gameStateAdapter';
import { requestGameState, startHand } from '../../net/socket';
import { TABLE_PAGE_MOCK } from '../../mocks/tableMock';
import { useGameStore } from '../../state/gameStore';
import { useRoomStore } from '../../state/roomStore';
import { useSessionStore } from '../../state/sessionStore';

export function TablePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const nickname = useSessionStore((s) => s.nickname);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const gameState = useGameStore((s) => s.gameState);
  const isGameLoading = useGameStore((s) => s.isGameLoading);
  const gameError = useGameStore((s) => s.gameError);
  const roomState = useRoomStore((s) => s.roomState);

  useEffect(() => {
    if (!roomId) return;
    requestGameState(roomId);
  }, [roomId]);

  const adapted = useMemo(() => {
    if (!gameState) return null;
    return adaptPlayerGameState(gameState, nickname);
  }, [gameState, nickname]);

  const usingLiveState = adapted != null;
  const m = useMemo(() => {
    if (!adapted) return TABLE_PAGE_MOCK;
    return {
      ...TABLE_PAGE_MOCK,
      ...adapted,
      handHistory: TABLE_PAGE_MOCK.handHistory,
      chatMessages: TABLE_PAGE_MOCK.chatMessages,
    };
  }, [adapted]);

  const showStartHand =
    connectionStatus === 'connected' &&
    roomId != null &&
    (!gameState || gameState.handId == null);

  const handleStartHand = useCallback(() => {
    if (!roomId) return;
    startHand(roomId);
  }, [roomId]);

  const statusLabel =
    connectionStatus === 'connecting'
      ? 'Connecting to room…'
      : connectionStatus === 'error'
        ? 'Connection issue — check join page'
        : isGameLoading
          ? 'Loading game state…'
          : gameError
            ? gameError
            : null;

  const roomMeta =
    roomState != null
      ? `${roomState.code} · ${roomState.players.length}/${roomState.maxSeats} · ${roomState.status}${
          !gameState?.handId ? ' · waiting for hand' : ''
        }`
      : null;

  return (
    <div className="table-page">
      {statusLabel ? (
        <p className="table-page__status" aria-live="polite">
          {statusLabel}
        </p>
      ) : null}
      {roomMeta ? (
        <p className="table-page__room-meta" aria-live="polite">
          {roomMeta}
        </p>
      ) : null}
      {showStartHand ? (
        <div className="table-page__pregame">
          <button
            type="button"
            className="table-page__start-hand"
            onClick={handleStartHand}
          >
            Start Hand
          </button>
        </div>
      ) : null}
      <TableSurface />
      <Pot amount={m.potAmount} showChips={m.showPotChips} />
      <BoardCards cards={m.boardCards} reveal={m.boardReveal} />
      {adapted?.heroHoleCards ? (
        <HeroHoleCards cards={adapted.heroHoleCards} />
      ) : null}
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
        gameInfo={
          usingLiveState
            ? { ...m.gameInfo, playerCount: roomState?.players.length ?? m.gameInfo.playerCount }
            : m.gameInfo
        }
      />
    </div>
  );
}
