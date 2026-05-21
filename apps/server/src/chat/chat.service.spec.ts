import { describe, expect, it } from 'vitest';

import { ChatService } from './chat.service';

describe('ChatService', () => {
  const service = new ChatService();
  const roomId = 'room-chat-1';
  const alice = { playerId: 'p-alice', nickname: 'Alice' };
  const bob = { playerId: 'p-bob', nickname: 'Bob' };

  it('stores trimmed messages with incrementing sequence', () => {
    service.addMessage(roomId, alice, '  hello  ');
    const snapshot = service.getMessages(roomId);
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]!.text).toBe('hello');
    expect(snapshot.messages[0]!.sequence).toBe(1);
    expect(snapshot.messages[0]!.nickname).toBe('Alice');
  });

  it('keeps only the last 100 messages per room', () => {
    const capRoom = 'room-cap';
    for (let i = 0; i < 105; i += 1) {
      service.addMessage(capRoom, alice, `msg-${i}`);
    }
    const snapshot = service.getMessages(capRoom);
    expect(snapshot.messages).toHaveLength(100);
    expect(snapshot.messages[0]!.text).toBe('msg-5');
    expect(snapshot.messages[99]!.text).toBe('msg-104');
    expect(snapshot.messages[0]!.sequence).toBe(6);
    expect(snapshot.messages[99]!.sequence).toBe(105);
  });

  it('isolates sequences per room', () => {
    service.clearRoom(roomId);
    service.addMessage(roomId, alice, 'a');
    service.addMessage('room-other', bob, 'b');
    expect(service.getMessages(roomId).messages[0]!.sequence).toBe(1);
    expect(service.getMessages('room-other').messages[0]!.sequence).toBe(1);
  });

  it('clearRoom removes history', () => {
    service.addMessage(roomId, alice, 'gone');
    service.clearRoom(roomId);
    expect(service.getMessages(roomId).messages).toEqual([]);
  });
});
