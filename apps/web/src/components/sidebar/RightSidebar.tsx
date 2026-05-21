import './Sidebar.css';

import { ChatPanel } from './ChatPanel';
import { GameInfoPanel } from './GameInfoPanel';
import { HandHistoryPanel } from './HandHistoryPanel';
import type { ChatMessageMock, GameInfoMock, HandHistoryStreet } from '../../mocks/tableMock';

export interface RightSidebarProps {
  handHistory: HandHistoryStreet[];
  chatMessages: ChatMessageMock[];
  chatDisabled: boolean;
  chatError: string | null;
  onSendChat: (text: string) => void;
  gameInfo: GameInfoMock;
}

export function RightSidebar({
  handHistory,
  chatMessages,
  chatDisabled,
  chatError,
  onSendChat,
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
      <GameInfoPanel info={gameInfo} />
    </aside>
  );
}
