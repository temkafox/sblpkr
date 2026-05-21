import './TablePage.css';

import { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ActionBar } from '../../components/action-bar/ActionBar';
import { BoardCards } from '../../components/cards/BoardCards';
import { HandResultBanner } from '../../components/result/HandResultBanner';
import { SeatLayer } from '../../components/seats/SeatLayer';
import { Pot } from '../../components/table/Pot';
import { TableSurface } from '../../components/table/TableSurface';
import { RightSidebar } from '../../components/sidebar/RightSidebar';
import {
  adaptPlayerGameState,
  adaptRoomLobbyState,
  countEligibleForNextHand,
  createWaitingLiveTableView,
  resolveViewerServerSeatIndex,
  isActiveHand,
  viewerSeatStack,
} from '../../lib/gameStateAdapter';
import { formatChips } from '../../lib/formatChips';
import { gameStateMatchesRoomRoster } from '../../lib/gameStateRoster';
import { chatRowsFromMessages } from '../../lib/chatAdapter';
import { formatRoomMetaLine } from '../../lib/tableRoomMeta';
import {
  rebuy,
  requestChatMessages,
  requestGameState,
  requestHandHistory,
  sendChatMessage,
  sendPlayerAction,
  startHand,
} from '../../net/socket';
import { useChatStore } from '../../state/chatStore';
import { useGameStore } from '../../state/gameStore';
import { useRoomStore } from '../../state/roomStore';
import { useSessionStore } from '../../state/sessionStore';

export function TablePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const nickname = useSessionStore((s) => s.nickname);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const gameState = useGameStore((s) => s.gameState);
  const handResult = useGameStore((s) => s.handResult);
  const handHistory = useGameStore((s) => s.handHistory);
  const isGameLoading = useGameStore((s) => s.isGameLoading);
  const isSubmittingAction = useGameStore((s) => s.isSubmittingAction);
  const gameError = useGameStore((s) => s.gameError);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const chatError = useChatStore((s) => s.chatError);
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
  const eligibleForHand = countEligibleForNextHand(gameState, roomState);
  const enoughChipsForHand = eligibleForHand >= minPlayersToStart;
  const hasActiveHand =
    isActiveHand(gameState) &&
    rosterAligned &&
    enoughPlayersForHand;
  const handComplete = Boolean(hasActiveHand && gameState?.handComplete);
  const handInProgress = hasActiveHand && !handComplete;
  const showHandResult =
    handComplete &&
    handResult != null &&
    handResult.handId === gameState?.handId;

  const viewerSeatIndex =
    gameState != null
      ? resolveViewerServerSeatIndex(gameState, nickname)
      : null;
  const availableActions = gameState?.availableActions;
  const isMyTurn =
    handInProgress &&
    availableActions != null &&
    viewerSeatIndex != null &&
    gameState?.activeSeatIndex === viewerSeatIndex;

  useEffect(() => {
    if (!roomId) return;
    useChatStore.getState().clearChatMessages();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const cached = useGameStore.getState().gameState;
    if (cached?.tableId !== roomId) {
      useGameStore.getState().clearGameState();
      useGameStore.getState().setGameLoading(true);
    }
    requestGameState(roomId);
    requestHandHistory(roomId);
  }, [roomId]);

  useEffect(() => {
    if (
      !roomId ||
      connectionStatus !== 'connected' ||
      roomState?.roomId !== roomId
    ) {
      return;
    }
    requestChatMessages(roomId);
  }, [roomId, connectionStatus, roomState?.roomId]);

  const chatRows = useMemo(
    () => chatRowsFromMessages(chatMessages),
    [chatMessages],
  );

  const chatDisabled =
    !isLiveRoom ||
    connectionStatus !== 'connected' ||
    roomId == null ||
    roomState?.roomId !== roomId;

  const handleSendChat = useCallback(
    (text: string) => {
      if (roomId == null || chatDisabled) return;
      sendChatMessage(roomId, text);
    },
    [roomId, chatDisabled],
  );

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
    enoughChipsForHand &&
    !hasActiveHand;

  const canStartNextHand =
    isLiveRoom &&
    connectionStatus === 'connected' &&
    roomId != null &&
    playerCount >= minPlayersToStart &&
    enoughChipsForHand &&
    showHandResult;

  const waitingForPlayers =
    isLiveRoom && !hasActiveHand && playerCount < minPlayersToStart;

  const waitingForChips =
    isLiveRoom &&
    !handInProgress &&
    !handComplete &&
    playerCount >= minPlayersToStart &&
    !enoughChipsForHand;

  const viewerStack = viewerSeatStack(gameState, viewerSeatIndex);
  const canRebuy =
    isLiveRoom &&
    connectionStatus === 'connected' &&
    roomId != null &&
    !handInProgress &&
    viewerStack != null &&
    viewerStack <= 0;

  const rebuyAmount = 200;

  const handleStartHand = useCallback(() => {
    if (!roomId || !canStartHand) return;
    startHand(roomId);
  }, [roomId, canStartHand]);

  const handleStartNextHand = useCallback(() => {
    if (!roomId || !canStartNextHand) return;
    startHand(roomId);
  }, [roomId, canStartNextHand]);

  const handleRebuy = useCallback(() => {
    if (!roomId || !canRebuy) return;
    rebuy(roomId);
  }, [roomId, canRebuy]);

  const emitAction = useCallback(
    (action: Parameters<typeof sendPlayerAction>[1]) => {
      if (!roomId || !isMyTurn || isSubmittingAction) return;
      sendPlayerAction(roomId, action);
    },
    [roomId, isMyTurn, isSubmittingAction],
  );

  const handleFold = useCallback(() => {
    emitAction({ kind: 'fold' });
  }, [emitAction]);

  const handleCheck = useCallback(() => {
    emitAction({ kind: 'check' });
  }, [emitAction]);

  const handleCall = useCallback(() => {
    emitAction({ kind: 'call' });
  }, [emitAction]);

  const handleRaise = useCallback(
    (amount: number) => {
      emitAction({ kind: 'raise', amount });
    },
    [emitAction],
  );

  const handleAllIn = useCallback(() => {
    emitAction({ kind: 'allin' });
  }, [emitAction]);

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
            : waitingForChips
              ? 'Not enough players with chips — waiting for rebuy'
              : waitingForPlayers
                ? 'Waiting for another player (need at least 2)'
                : null;

  const actionErrorLabel =
    handInProgress && gameError != null && gameError.length > 0
      ? gameError
      : null;

  const rebuyErrorLabel =
    !handInProgress && gameError != null && gameError.length > 0
      ? gameError
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
      {actionErrorLabel ? (
        <p className="table-page__action-error" aria-live="polite">
          {actionErrorLabel}
        </p>
      ) : null}
      {rebuyErrorLabel ? (
        <p className="table-page__rebuy-error" aria-live="polite">
          {rebuyErrorLabel}
        </p>
      ) : null}
      {roomMeta ? (
        <p className="table-page__room-meta" aria-live="polite">
          {roomMeta}
        </p>
      ) : null}
      {canRebuy ? (
        <div className="table-page__rebuy">
          <button
            type="button"
            className="table-page__rebuy-btn"
            onClick={handleRebuy}
            disabled={isGameLoading}
          >
            Rebuy ${formatChips(rebuyAmount)}
          </button>
        </div>
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
      {canStartNextHand ? (
        <div className="table-page__next-hand">
          <button
            type="button"
            className="table-page__start-hand table-page__start-hand--next"
            onClick={handleStartNextHand}
          >
            Start Next Hand
          </button>
        </div>
      ) : null}
      <TableSurface />
      <Pot amount={tableView.potAmount} showChips={tableView.showPotChips} />
      {showHandResult ? (
        <HandResultBanner
          result={handResult}
          roomState={roomState}
          gameState={gameState}
        />
      ) : null}
      {handActive ? (
        <BoardCards
          cards={tableView.boardCards}
          reveal={tableView.boardReveal}
        />
      ) : null}
      <SeatLayer
        layout={tableView.layout}
        playersBySeatIndex={tableView.playersBySeatIndex}
        seatStatesBySeatIndex={tableView.seatStatesBySeatIndex}
        gameState={tableView.gameState}
        handActive={handActive}
        heroHoleCards={tableView.heroHoleCards}
      />
      {handInProgress ? (
        <ActionBar
          availableActions={availableActions}
          potAmount={gameState?.pot.total ?? 0}
          callAmount={availableActions?.callAmount ?? 0}
          minRaise={availableActions?.minRaise ?? 0}
          maxRaise={availableActions?.maxRaise ?? 0}
          isMyTurn={isMyTurn}
          isSubmittingAction={isSubmittingAction}
          onFold={handleFold}
          onCheck={handleCheck}
          onCall={handleCall}
          onRaise={handleRaise}
          onAllIn={handleAllIn}
        />
      ) : null}
      <RightSidebar
        handHistory={handHistory}
        chatMessages={chatRows}
        chatDisabled={chatDisabled}
        chatError={chatError}
        onSendChat={handleSendChat}
        gameInfo={tableView.gameInfo}
      />
    </div>
  );
}
