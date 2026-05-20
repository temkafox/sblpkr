import { Module, forwardRef } from '@nestjs/common';

import { RoomModule } from '../room/room.module';
import { TableModule } from '../table/table.module';
import { GameBroadcastService } from './game-broadcast';
import { GameService } from './game.service';

@Module({
  imports: [forwardRef(() => RoomModule), TableModule],
  providers: [GameService, GameBroadcastService],
  exports: [GameService, GameBroadcastService],
})
export class GameModule {}
