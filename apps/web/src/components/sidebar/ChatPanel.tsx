import './Sidebar.css';

import { useEffect, useRef, useState } from 'react';

import { CHAT_MESSAGE_MAX_LENGTH } from '@neonpoker/shared';

import type { ChatMessageMock } from '../../mocks/tableMock';

export interface ChatPanelProps {
  messages: ChatMessageMock[];
  disabled: boolean;
  error: string | null;
  onSend: (text: string) => void;
}

function chatToneClass(tone: ChatMessageMock['cls']) {
  return `np-chat-tone-${tone}`;
}

export function ChatPanel({ messages, disabled, error, onSend }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  const tooLong = draft.length > CHAT_MESSAGE_MAX_LENGTH;
  const canSend =
    !disabled && trimmed.length > 0 && !tooLong;

  useEffect(() => {
    const el = scrollRef.current;
    if (el == null || messages.length === 0) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(trimmed);
    setDraft('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="np-panel np-chat">
      <div className="np-panel-head">
        <h3>TABLE CHAT</h3>
        <span className="np-panel-chev">▾</span>
      </div>
      <div className="np-chat-body">
        <div className="np-chat-scroll" ref={scrollRef}>
          {messages.length === 0 ? (
            <p className="np-chat-empty">No messages yet</p>
          ) : null}
          {messages.map((row) => (
            <div className="np-chat-row" key={row.id ?? `${row.who}-${row.msg}`}>
              <span className={`np-chat-who ${chatToneClass(row.cls)}`}>{row.who}:</span>
              <span className="np-chat-msg">{row.msg}</span>
            </div>
          ))}
        </div>
        {error != null && error.length > 0 ? (
          <p className="np-chat-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="np-chat-input">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            disabled={disabled}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={2}
            aria-label="Chat message"
          />
          <button
            type="button"
            className="np-chat-send"
            disabled={!canSend}
            aria-label="Send message"
            onClick={handleSend}
          >
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
