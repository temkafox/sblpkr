import { Module } from '@nestjs/common';

import { RoomModule } from '../room/room.module';
import { TableModule } from '../table/table.module';
import { GameService } from './game.service';

@Module({
  imports: [RoomModule, TableModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
