import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { JoinGameDto } from './dto/join-game.dto';
import { PlayersService } from '../players/players.service';
import { AuthService } from '../auth/auth.service';
import { randomBytes } from 'crypto';
import { Game } from '@prisma/client';
import { WsGateway } from '../websockets/ws.gateway';

@Controller('games')
export class GamesController {
  private readonly logger = new Logger(GamesController.name);

  constructor(
    private readonly gamesService: GamesService,
    private readonly playersService: PlayersService,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => WsGateway))
    private readonly wsGateway: WsGateway,
  ) {}

  // ------------------------------------------------------------
  // Endpoints públicos para crear y unirse a partidas
  // ------------------------------------------------------------

  @Post('create')
  async createGame(@Body() body: CreateGameDto) {
    this.logger.debug('Creando juego con datos:', body);
    
    const { playerName, playerCount: _playerCount } = body;
    
    if (!playerName) {
      this.logger.error('playerName es nulo o undefined');
      throw new Error('playerName es requerido');
    }

    // Generar código único de 6 caracteres alfanumérico
    const code = randomBytes(3).toString('hex').toUpperCase();
    this.logger.debug('Código generado:', code);

    try {
      // Crear juego
      const game = await this.gamesService.create({ code, stage: 'lobby' });
      this.logger.debug('Juego creado:', game);
      
      // Proteger el juego contra eliminación automática (30 segundos)
      this.wsGateway.protectNewGame(code, 30000);
      this.logger.debug('Juego protegido contra eliminación automática');

      // Crear jugador host
      const player = await this.playersService.create({ 
        name: playerName, 
        isHost: true, 
        gameId: game.id 
      });
      this.logger.debug('Jugador creado:', player);

      // Firmar JWT
      const accessToken = this.authService.signPayload({ 
        playerId: player.id, 
        gameId: game.id, 
        code 
      });

      return {
        gameCode: code,
        playerId: player.id,
        accessToken,
      };
    } catch (error) {
      this.logger.error('Error en la creación del juego:', error);
      throw error;
    }
  }

  @Post(':code/join')
  async joinGame(@Param('code') code: string, @Body() body: JoinGameDto) {
    this.logger.debug('Uniéndose al juego con datos:', { code, body });
    const { playerName } = body;
    this.logger.debug('playerName:', playerName);

    // Buscar juego
    const game = await this.gamesService.findByCode(code);
    if (!game) {
      this.logger.error('Juego no encontrado:', code);
      return { error: 'Game not found' };
    }
    this.logger.debug('Juego encontrado:', game);

    // Crear jugador
    this.logger.debug('Creando jugador con datos:', { name: playerName, isHost: false, gameId: game.id });
    const player = await this.playersService.create({ name: playerName, isHost: false, gameId: game.id });
    this.logger.debug('Jugador creado:', player);

    // Recargar juego con el nuevo jugador incluido
    const updatedGame = await this.gamesService.findByCode(code);

    // Firmar JWT
    const accessToken = this.authService.signPayload({ playerId: player.id, gameId: game.id, code });

    return {
      game: updatedGame,
      playerId: player.id,
      accessToken,
    };
  }

  // ------------------------------------------------------------
  // Endpoints protegidos (requieren JWT)
  // ------------------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.gamesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.gamesService.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gamesService.remove(id);
  }

  // Endpoint público para obtener juego por código
  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.gamesService.findByCode(code);
  }

} 