import { Module, forwardRef } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { PlayersModule } from '../players/players.module';
import { AuthModule } from '../auth/auth.module';
import { WsModule } from '../websockets/ws.module';

@Module({
  imports: [PlayersModule, AuthModule, forwardRef(() => WsModule)],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {} 