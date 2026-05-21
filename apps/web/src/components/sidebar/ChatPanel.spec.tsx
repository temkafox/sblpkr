import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CHAT_MESSAGE_MAX_LENGTH } from '@neonpoker/shared';

import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  it('shows empty state when there are no messages', () => {
    render(
      <ChatPanel messages={[]} disabled={false} error={null} onSend={vi.fn()} />,
    );
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('renders chat messages as plain text with chat tone class on nickname', () => {
    render(
      <ChatPanel
        messages={[{ id: 'm1', who: 'Neo', cls: 'cyan', msg: 'gl hf' }]}
        disabled={false}
        error={null}
        onSend={vi.fn()}
      />,
    );
    const who = screen.getByText('Neo:');
    expect(who).toHaveClass('np-chat-tone-cyan');
    expect(screen.getByText('gl hf')).toBeInTheDocument();
  });

  it('sends trimmed message on Enter', () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatPanel messages={[]} disabled={false} error={null} onSend={onSend} />,
    );
    const input = within(container).getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: '  hi there  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hi there');
  });

  it('does not send empty or whitespace-only input', () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatPanel messages={[]} disabled={false} error={null} onSend={onSend} />,
    );
    const input = within(container).getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('disables send when message exceeds max length', () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatPanel messages={[]} disabled={false} error={null} onSend={onSend} />,
    );
    const input = within(container).getByLabelText('Chat message');
    fireEvent.change(input, {
      target: { value: 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1) },
    });
    expect(screen.getByLabelText('Send message')).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('auto-scrolls to the latest message', () => {
    const { container, rerender } = render(
      <ChatPanel
        messages={[{ id: 'm1', who: 'A', cls: 'cyan', msg: 'one' }]}
        disabled={false}
        error={null}
        onSend={vi.fn()}
      />,
    );
    const scroll = container.querySelector('.np-chat-scroll') as HTMLDivElement;
    Object.defineProperty(scroll, 'scrollHeight', { value: 400, configurable: true });
    scroll.scrollTop = 0;

    rerender(
      <ChatPanel
        messages={[
          { id: 'm1', who: 'A', cls: 'cyan', msg: 'one' },
          { id: 'm2', who: 'B', cls: 'magenta', msg: 'two' },
        ]}
        disabled={false}
        error={null}
        onSend={vi.fn()}
      />,
    );

    expect(scroll.scrollTop).toBe(400);
  });
});
