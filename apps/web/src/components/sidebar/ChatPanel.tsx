import './Sidebar.css';

import type { ChatMessageMock } from '../../mocks/tableMock';

export interface ChatPanelProps {
  messages: ChatMessageMock[];
}

function nameColorClass(cls: ChatMessageMock['cls']) {
  return `np-namecolor-${cls}`;
}

export function ChatPanel({ messages }: ChatPanelProps) {
  return (
    <div className="np-panel np-chat">
      <div className="np-panel-head">
        <h3>TABLE CHAT</h3>
        <span className="np-panel-chev">▾</span>
      </div>
      <div className="np-chat-body">
        <div className="np-chat-scroll">
          {messages.map((row, i) => (
            <div className="np-chat-row" key={i}>
              <span className={`np-chat-who ${nameColorClass(row.cls)}`}>{row.who}:</span>
              <span className="np-chat-msg">{row.msg}</span>
            </div>
          ))}
        </div>
        <div className="np-chat-input">
          <input readOnly placeholder="Type your message…" tabIndex={-1} aria-disabled="true" />
          <button type="button" className="np-chat-send" disabled aria-label="Send (inactive in Phase 1B)">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
