import { Module } from '@nestjs/common';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { RoomModule } from './room/room.module';

@Module({
  imports: [HealthModule, RoomModule, GameModule],
})
export class AppModule {}
