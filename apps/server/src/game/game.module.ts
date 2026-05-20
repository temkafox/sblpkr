import { Module, forwardRef } from '@nestjs/common';

import { RoomModule } from '../room/room.module';
import { TableModule } from '../table/table.module';
import { GameBroadcastService } from './game-broadcast';
import { HandHistoryService } from './hand-history.service';
import { GameService } from './game.service';

@Module({
  imports: [forwardRef(() => RoomModule), TableModule],
  providers: [HandHistoryService, GameService, GameBroadcastService],
  exports: [HandHistoryService, GameService, GameBroadcastService],
})
export class GameModule {}
