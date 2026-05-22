import { Module, forwardRef } from '@nestjs/common';

import { RoomModule } from '../room/room.module';
import { TableModule } from '../table/table.module';
import { ActionTimerService } from './action-timer.service';
import { GameBroadcastService } from './game-broadcast';
import { HandHistoryService } from './hand-history.service';
import { NextHandReadyService } from './next-hand-ready.service';
import { GameService } from './game.service';

@Module({
  imports: [forwardRef(() => RoomModule), TableModule],
  providers: [
    HandHistoryService,
    GameService,
    NextHandReadyService,
    GameBroadcastService,
    ActionTimerService,
  ],
  exports: [
    HandHistoryService,
    GameService,
    NextHandReadyService,
    GameBroadcastService,
    ActionTimerService,
  ],
})
export class GameModule {}
