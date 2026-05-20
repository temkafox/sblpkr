import { describe, expect, it } from 'vitest';

import { DEFAULT_STARTING_CHIPS } from '../game/game.constants';
import { GameService } from '../game/game.service';
import { TableService } from '../table/table.service';
import { RoomService } from './room.service';

describe('Room reconnect preserves table stacks', () => {
  const roomId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('reconnect with same clientSessionId keeps chip stack', () => {
    const roomService = RoomService.forTest({
      code: () => 'STACK1',
      id: () => roomId,
      gracePeriodMs: 60_000,
    });
    const tableService = new TableService();
    const gameService = GameService.forTest({ roomService, tableService });

    const room = roomService.createRoom({ maxSeats: 6 });
    const clientSid = 'session-stack';

    roomService.registerNickname('sock-a', {
      nickname: 'Alpha',
      clientSessionId: clientSid,
    });
    roomService.joinRoom('sock-a', {
      roomId: room.roomId,
      clientSessionId: clientSid,
    });

    roomService.registerNickname('sock-b', {
      nickname: 'Beta',
      clientSessionId: 'session-beta',
    });
    roomService.joinRoom('sock-b', {
      roomId: room.roomId,
      clientSessionId: 'session-beta',
    });

    gameService.startHand(room.roomId);
    const before = gameService.getGameState(room.roomId);
    const alphaId = roomService.getSession('sock-a')!.playerId!;
    const stackBefore = before.playersById[alphaId]!.chips;

    const anyChanged = Object.values(before.playersById).some(
      (p) => p.chips !== DEFAULT_STARTING_CHIPS,
    );
    expect(anyChanged).toBe(true);

    roomService.handleDisconnect('sock-a');

    roomService.registerNickname('sock-c', {
      nickname: 'Alpha',
      clientSessionId: clientSid,
    });
    roomService.joinRoom('sock-c', {
      roomId: room.roomId,
      clientSessionId: clientSid,
    });

    const after = gameService.getGameState(room.roomId);
    const stackAfter = after.playersById[alphaId]!.chips;

    expect(stackAfter).toBe(stackBefore);
    expect(stackAfter).not.toBe(DEFAULT_STARTING_CHIPS);
  });
});
