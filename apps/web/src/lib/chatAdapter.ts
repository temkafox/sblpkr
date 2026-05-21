import type { ChatMessage } from '@neonpoker/shared';

import type { ChatMessageMock } from '../mocks/tableMock';
import { getChatPlayerColorKey, getChatPlayerTone } from './chatPlayerColor';

/** Maps server chat messages to sidebar row display. */
export function chatRowsFromMessages(messages: ChatMessage[]): ChatMessageMock[] {
  return messages.map((message) => {
    const colorKey = getChatPlayerColorKey(message);
    return {
      id: message.id,
      who: message.nickname,
      cls: getChatPlayerTone(colorKey),
      msg: message.text,
    };
  });
}
