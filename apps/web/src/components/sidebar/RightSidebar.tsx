import './Sidebar.css';

import { ChatPanel } from './ChatPanel';
import { GameInfoPanel } from './GameInfoPanel';
import { HandHistoryPanel } from './HandHistoryPanel';
import type { ChatMessageMock, GameInfoMock, HandHistoryStreet } from '../../mocks/tableMock';

export interface RightSidebarProps {
  handHistory: HandHistoryStreet[];
  chatMessages: ChatMessageMock[];
  gameInfo: GameInfoMock;
}

export function RightSidebar({ handHistory, chatMessages, gameInfo }: RightSidebarProps) {
  return (
    <aside className="np-sidebar">
      <HandHistoryPanel streets={handHistory} />
      <ChatPanel messages={chatMessages} />
      <GameInfoPanel info={gameInfo} />
    </aside>
  );
}
