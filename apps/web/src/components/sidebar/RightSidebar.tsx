import './Sidebar.css';

import { ChatPanel } from './ChatPanel';
import { GameInfoPanel } from './GameInfoPanel';
import { HandHistoryPanel } from './HandHistoryPanel';
import { NextHandPanel } from './NextHandPanel';
import type { NextHandReadyStatePayload } from '@neonpoker/shared';
import type { ChatMessageMock, GameInfoMock, HandHistoryStreet } from '../../mocks/tableMock';

export interface RightSidebarProps {
  handHistory: HandHistoryStreet[];
  chatMessages: ChatMessageMock[];
  chatDisabled: boolean;
  chatError: string | null;
  onSendChat: (text: string) => void;
  nextHandReady: NextHandReadyStatePayload | null;
  gameInfo: GameInfoMock;
}

export function RightSidebar({
  handHistory,
  chatMessages,
  chatDisabled,
  chatError,
  onSendChat,
  nextHandReady,
  gameInfo,
}: RightSidebarProps) {
  return (
    <aside className="np-sidebar">
      <HandHistoryPanel streets={handHistory} />
      <ChatPanel
        messages={chatMessages}
        disabled={chatDisabled}
        error={chatError}
        onSend={onSendChat}
      />
      {nextHandReady != null && nextHandReady.requiredCount > 0 ? (
        <NextHandPanel readyState={nextHandReady} />
      ) : null}
      <GameInfoPanel info={gameInfo} />
    </aside>
  );
}
