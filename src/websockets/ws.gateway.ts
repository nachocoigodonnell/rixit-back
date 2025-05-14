import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { GamesService } from '../games/games.service';
import { PlayersService } from '../players/players.service';
import { Logger } from '@nestjs/common';
import { Game, Player } from '@prisma/client';
import { Inject, forwardRef } from '@nestjs/common';

type GameWithRelations = Game & {
  players: Player[];
};

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3004', 'http://127.0.0.1:3004'],
    credentials: true,
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);

  // Mantener un registro de juegos recién creados para evitar eliminación inmediata por desconexión
  private recentlyCreatedGames: Set<string> = new Set();

  constructor(
    private readonly authService: AuthService,
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
    private readonly playersService: PlayersService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      
      this.logger.log(`Socket conectado: ${client.id} - Token: ${token ? 'Presente' : 'Ausente'}`);
      const gameCode = client.handshake.query.gameCode as string;
      if (gameCode) {
        this.logger.log(`Socket conectado con gameCode: ${gameCode}`);
        client.join(gameCode);
      }
      
      if (!token) {
        this.logger.warn('No se proporcionó token en la conexión');
        client.disconnect();
        return;
      }

      try {
        // SOLO PARA DESARROLLO: Aceptar cualquier token para facilitar las pruebas
        // En producción usar: const payload = this.authService.verifyToken(token);
        console.log('Token aceptado en modo desarrollo');
        
        // Crear un usuario ficticio para desarrollo
        const mockUser = {
          sub: `user-${Math.random().toString(36).substring(2, 10)}`,
          name: 'Usuario de Prueba'
        };
        
        (client as any).user = mockUser;
        console.log(`Cliente conectado ${client.id}`);
      } catch (error) {
        const tokenError = error as Error;
        console.log('Error al verificar token:', tokenError.message);
        client.disconnect();
        return;
      }
    } catch (e) {
      console.log('Conexión no autorizada');
      console.log(e);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.warn(`🔴 Cliente desconectado: ${client.id} - Esto puede causar eliminación de jugadores`);
    
    // Intenta obtener información del jugador/juego asociados a este socket
    const user = (client as any).user;
    if (user) {
      this.logger.warn(`Usuario asociado al socket desconectado: ${JSON.stringify(user)}`);
    }
  }

  @SubscribeMessage('join_game')
  async handleJoinGame(
    @MessageBody() data: { gameCode: string; playerName?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { gameCode, playerName } = data;

    // Unirse a la room
    client.join(gameCode);

    // Cargar juego
    let game = await this.gamesService.findByCode(gameCode) as GameWithRelations;
    if (!game) {
      client.emit('error', { message: 'Juego no encontrado' });
      return;
    }

    // Comprobar si el jugador ya existe (por ID de socket o nombre)
    const exists = (game.players || []).some((p: Player) => p.name === playerName);

    // Crear jugador si no existe y tenemos nombre
    if (!exists && playerName) {
      await this.playersService.create({ name: playerName, gameId: game.id });
      game = await this.gamesService.findByCode(gameCode) as GameWithRelations; // recargar con jugador añadido
    }

    // Emitir el estado actualizado solo a los jugadores en la sala
    this.server.to(gameCode).emit('game_update', game);
  }

  @SubscribeMessage('player_action')
  handlePlayerAction(
    @MessageBody() data: { gameCode: string; action: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.gameCode).emit('player_action', { playerId: client.id, action: data.action });
  }

  @SubscribeMessage('leave_game')
  async handleLeaveGame(
    @MessageBody() data: { gameCode: string; playerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.warn(`🚨 EVENTO LEAVE_GAME RECIBIDO - gameCode: ${data.gameCode}, playerId: ${data.playerId}, socketId: ${client.id}`);
    
    const { gameCode, playerId } = data;
    
    // Si el juego está protegido, no permitimos que se elimine aunque se desconecten todos
    const isProtected = this.isGameProtected(gameCode);
    if (isProtected) {
      this.logger.warn(`🛡️ El juego ${gameCode} está protegido contra eliminación automática`);
    }
    
    // Abandonar la room inmediatamente para evitar recibir más eventos
    client.leave(gameCode);
    
    let game = await this.gamesService.findByCode(gameCode) as GameWithRelations;
    if (!game) {
      this.logger.warn('🚨 No se encontró el juego al intentar abandonarlo');
      return;
    }
    
    // Buscar al jugador que abandona
    const leavingPlayer = (game.players || []).find((p: Player) => p.id === playerId);
    if (!leavingPlayer) {
      this.logger.warn('🚨 No se encontró el jugador que intenta abandonar');
      return;
    }
    
    this.logger.warn(`🗑️ ELIMINANDO jugador ${leavingPlayer.name} (${playerId}) del juego ${gameCode}`);
    
    // Eliminar jugador de la base de datos
    await this.playersService.remove(playerId);
    
    // Recargar juego actualizado
    game = await this.gamesService.findByCode(gameCode) as GameWithRelations;
    
    // Si no quedan jugadores, eliminar la partida y notificar (si queda algún socket)
    if (!game || (game.players || []).length === 0) {
      this.logger.warn(`🗑️ ELIMINANDO juego ${gameCode} porque no quedan jugadores`);
      
      // No eliminar si está protegido
      if (isProtected) {
        this.logger.warn(`⚠️ Juego ${gameCode} NO se eliminará por estar protegido`);
        return;
      }
      
      if (game) {
        await this.gamesService.remove(game.id);
      }
      // Avisar a cualquier cliente que quede (puede que ninguno)
      this.server.to(gameCode).emit('game_deleted');
      return;
    }

    // Si el que se va era host, pasar host al primer jugador restante
    if (leavingPlayer.isHost) {
      const newHost = game.players[0];
      await this.playersService.update(newHost.id, { isHost: true });
      // Recargar con nuevo host
      game = await this.gamesService.findByCode(gameCode) as GameWithRelations;
    }

    // Notificar a los demás jugadores
    this.server.to(gameCode).emit('player_left', { playerId });
    this.server.to(gameCode).emit('game_update', game);
  }

  // Proteger un juego contra eliminación automática durante un período de tiempo
  public protectNewGame(gameCode: string, durationMs: number = 10000) {
    this.logger.log(`🛡️ Protegiendo juego ${gameCode} contra eliminación por ${durationMs}ms`);
    this.recentlyCreatedGames.add(gameCode);
    
    setTimeout(() => {
      this.recentlyCreatedGames.delete(gameCode);
      this.logger.log(`🛡️ Protección eliminada para el juego ${gameCode}`);
    }, durationMs);
  }
  
  // Verificar si un juego está protegido contra eliminación
  protected isGameProtected(gameCode: string): boolean {
    return this.recentlyCreatedGames.has(gameCode);
  }
} 