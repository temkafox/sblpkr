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
import {
  adaptPlayerGameState,
  adaptRoomLobbyState,
  createWaitingLiveTableView,
  isActiveHand,
} from '../../lib/gameStateAdapter';
import { gameStateMatchesRoomRoster } from '../../lib/gameStateRoster';
import { formatRoomMetaLine } from '../../lib/tableRoomMeta';
import { requestGameState, startHand } from '../../net/socket';
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

  const isLiveRoom = Boolean(roomId);
  const minPlayersToStart = 2;
  const playerCount = roomState?.players.length ?? 0;
  const rosterAligned =
    gameState == null ||
    roomState == null ||
    gameStateMatchesRoomRoster(gameState, roomState);
  const enoughPlayersForHand =
    roomState == null || playerCount >= minPlayersToStart;
  const hasActiveHand =
    isActiveHand(gameState) &&
    rosterAligned &&
    enoughPlayersForHand;

  useEffect(() => {
    if (!roomId) return;
    requestGameState(roomId);
  }, [roomId]);

  const tableView = useMemo(() => {
    if (!isLiveRoom) {
      return createWaitingLiveTableView();
    }
    if (gameState && hasActiveHand) {
      return adaptPlayerGameState(gameState, nickname, roomState);
    }
    if (roomState) {
      return adaptRoomLobbyState(
        roomState,
        nickname,
        hasActiveHand ? null : gameState,
      );
    }
    return createWaitingLiveTableView();
  }, [isLiveRoom, gameState, hasActiveHand, roomState, nickname]);

  const handActive = tableView.phase === 'hand';
  const canStartHand =
    isLiveRoom &&
    connectionStatus === 'connected' &&
    roomId != null &&
    playerCount >= minPlayersToStart &&
    !hasActiveHand;

  const waitingForPlayers =
    isLiveRoom && !hasActiveHand && playerCount < minPlayersToStart;

  const handleStartHand = useCallback(() => {
    if (!roomId || !canStartHand) return;
    startHand(roomId);
  }, [roomId, canStartHand]);

  const hasLiveFeed =
    connectionStatus === 'connected' ||
    gameState != null ||
    roomState != null;

  const statusLabel =
    connectionStatus === 'connecting'
      ? 'Connecting to room…'
      : connectionStatus === 'error' && !hasLiveFeed
        ? 'Connection issue — check join page'
        : isGameLoading && !gameState && !roomState
          ? 'Loading game state…'
          : gameError && !hasLiveFeed
            ? gameError
            : waitingForPlayers
              ? 'Waiting for another player (need at least 2)'
              : null;

  const roomMeta =
    roomState != null
      ? formatRoomMetaLine(roomState, hasActiveHand ? gameState : null)
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
      {canStartHand ? (
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
      <Pot amount={tableView.potAmount} showChips={tableView.showPotChips} />
      {handActive ? (
        <BoardCards
          cards={tableView.boardCards}
          reveal={tableView.boardReveal}
        />
      ) : null}
      {tableView.heroHoleCards ? (
        <HeroHoleCards cards={tableView.heroHoleCards} />
      ) : null}
      <SeatLayer
        layout={tableView.layout}
        playersBySeatIndex={tableView.playersBySeatIndex}
        seatStatesBySeatIndex={tableView.seatStatesBySeatIndex}
        gameState={tableView.gameState}
        handActive={handActive}
      />
      {handActive ? <ActionBar mock={tableView.actionBar} /> : null}
      <RightSidebar
        handHistory={tableView.handHistory}
        chatMessages={tableView.chatMessages}
        gameInfo={tableView.gameInfo}
      />
    </div>
  );
}
