import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({ namespace: 'ws' })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly authService: AuthService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      const payload = this.authService.verifyToken(token);
      (client as any).user = payload;
      console.log(`Cliente conectado ${client.id}`);
    } catch (e) {
      console.log('Conexión no autorizada');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado ${client.id}`);
  }

  @SubscribeMessage('join_game')
  handleJoinGame(@MessageBody() data: { gameId: string }, @ConnectedSocket() client: Socket) {
    client.join(data.gameId);
    client.to(data.gameId).emit('player_joined', { playerId: client.id });
  }

  @SubscribeMessage('player_action')
  handlePlayerAction(
    @MessageBody() data: { gameId: string; action: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.gameId).emit('player_action', { playerId: client.id, action: data.action });
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(@MessageBody() data: { gameId: string }, @ConnectedSocket() client: Socket) {
    client.leave(data.gameId);
    client.to(data.gameId).emit('player_left', { playerId: client.id });
  }
} 