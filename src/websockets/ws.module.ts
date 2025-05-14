import { Module, forwardRef } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { AuthModule } from '../auth/auth.module';
import { GamesModule } from '../games/games.module';
import { PlayersModule } from '../players/players.module';

@Module({
  imports: [AuthModule, forwardRef(() => GamesModule), PlayersModule],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class WsModule {} 