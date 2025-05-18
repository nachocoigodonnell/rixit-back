import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Logger, Inject, forwardRef, Req } from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { JoinGameDto } from './dto/join-game.dto';
import { PlayersService } from '../players/players.service';
import { AuthService } from '../auth/auth.service';
import { randomBytes } from 'crypto';
import { Game, Player } from '@prisma/client';
import { WsGateway } from '../websockets/ws.gateway';
import { PrismaService } from '../prisma/prisma.service';

type GameWithRelations = Game & {
  players: Player[];
  rounds: any[];
};

// Mapa en memoria para almacenar submissions temporales por roundId
const submissionsMap: Record<string, { playerId: string; cardId: string }[]> = {};

@Controller('games')
export class GamesController {
  private readonly logger = new Logger(GamesController.name);

  constructor(
    private readonly gamesService: GamesService,
    private readonly playersService: PlayersService,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => WsGateway))
    private readonly wsGateway: WsGateway,
    private readonly prisma: PrismaService,
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

  // Endpoint para obtener juego por código filtrando la mano de cada jugador
  // Devuelve:
  // {
  //   game: { ...datos del juego, players: [{ id, name, score, isHost, hand?: [] }] },
  //   myHand: Card[] // mano del jugador autenticado (opcional)
  // }
  @Get('code/:code')
  async findByCode(@Param('code') code: string, @Req() req: any) {
    const game = await this.gamesService.findByCode(code) as GameWithRelations | null;
    if (!game) {
      return { error: 'Game not found' };
    }

    // Intentar extraer playerId del token JWT si existe
    let playerId: string | undefined;
    const authHeader: string | undefined = req.headers?.authorization || req.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload: any = this.authService.verifyToken(token);
        playerId = payload.playerId;
      } catch (err) {
        // Token inválido, ignoramos y continuamos sin playerId
        this.logger.warn('Token inválido en findByCode');
      }
    }

    // Filtrar manos y construir lista pública
    let myHand: any[] = [];
    // Cargar mano del jugador autenticado (si existe)
    if (playerId) {
      // @ts-ignore - la propiedad 'hand' existirá tras ejecutar prisma generate
      const handRecord = await this.prisma.hand.findFirst({
        where: { playerId },
        include: { cards: true },
      });
      myHand = handRecord?.cards || [];
    }

    const sanitizedPlayers = (game.players || []).map((p) => {
      // Omitimos la propiedad hand en caso de que exista todavía en Player
      const { hand: _omit, ...rest } = p as any;
      return rest;
    });

    // Obtener narratorId de la última ronda (si existe)
    let narratorId: string | undefined;
    if (game.rounds && game.rounds.length > 0) {
      const lastRound: any = game.rounds[game.rounds.length - 1];
      narratorId = lastRound.narratorId;
    }

    const sanitizedGame = {
      ...game,
      players: sanitizedPlayers,
      narratorId,
    };

    return {
      game: sanitizedGame,
      myHand,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':gameCode/start')
  async startRound(@Param('gameCode') gameCode: string) {
    this.logger.log(`Solicitud para iniciar juego con código: ${gameCode}`);
    try {
      // Buscar el juego por código
      const game = await this.gamesService.findByCode(gameCode) as GameWithRelations;
      if (!game) {
        throw new Error('Juego no encontrado');
      }

      // Cambiar el estado del juego a 'clue'
      const updatedGame = await this.gamesService.update(game.id, { stage: 'clue' });

      // Seleccionar narrador aleatorio
      const playersInGame = game.players || [];
      if (playersInGame.length === 0) {
        throw new Error('No hay jugadores en la partida');
      }

      // Seleccionar de forma aleatoria (puedes cambiar la lógica a rotación si lo prefieres)
      const narrator = playersInGame[Math.floor(Math.random() * playersInGame.length)];

      // Crear nueva ronda y asociarla al juego
      const roundCount = await this.prisma.round.count({ where: { gameId: game.id } });
      try {
        await this.prisma.round.create({
          data: {
            number: roundCount + 1,
            status: 'pending',
            clue: null,
            game: { connect: { id: game.id } },
            narrator: { connect: { id: narrator.id } }
          },
        });
        console.log('Ronda creada correctamente');
      } catch (error) {
        console.error('Error al crear ronda:', error);
        // Continuar con la ejecución, ya que al menos tenemos el narratorId
      }

      // Construir objeto de juego con narratorId incluido (sin persistir la columna)
      const gameWithNarrator: any = {
        ...updatedGame,
        players: playersInGame,
        narratorId: narrator.id,
      };

      // Notificar a todos los jugadores a través de WebSocket
      this.logger.log(`🔔 Notificando a los jugadores sobre el inicio del juego: ${gameCode} (Narrador: ${narrator.name})`);
      this.wsGateway.server.to(gameCode).emit('game_update', gameWithNarrator);
      
      return gameWithNarrator;
    } catch (error) {
      this.logger.error(`Error al iniciar juego ${gameCode}:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':gameCode/clue')
  async submitClue(
    @Param('gameCode') gameCode: string,
    @Body() body: { playerId: string; clue: string; cardId: string }
  ) {
    const { playerId, clue, cardId } = body;
    this.logger.log(`➡️ submitClue gameCode=${gameCode} playerId=${playerId} clue="${clue}" cardId=${cardId}`);
    
    // Notamos cardId actualmente no se persiste; se reservará para futuras mejoras

    // 1. Buscar juego y ronda actual
    const game = await this.gamesService.findByCode(gameCode) as GameWithRelations | null;
    if (!game) {
      throw new Error('Juego no encontrado');
    }

    // Obtener la última ronda (creada en startRound)
    const currentRound = await this.prisma.round.findFirst({
      where: { gameId: game.id },
      orderBy: { number: 'desc' },
    });

    if (!currentRound) {
      throw new Error('No existe una ronda activa');
    }

    // Comprobar que el jugador es el narrador
    if (currentRound.narratorId !== playerId) {
      throw new Error('Solo el narrador puede enviar la pista');
    }

    // 2. Actualizar la ronda con la pista (y más adelante la carta si se modela)
    await this.prisma.round.update({
      where: { id: currentRound.id },
      data: {
        clue,
        status: 'clue_submitted',
      },
    });

    // 3. Pasar el juego a la fase "submit"
    const updatedGame = await this.gamesService.update(game.id, { stage: 'submit' });

    // 4. Notificar a los jugadores via websocket
    const gameWithNarrator: any = {
      ...updatedGame,
      narratorId: playerId,
      clue,
      submissions: [],
    };
    this.wsGateway.server.to(gameCode).emit('game_update', gameWithNarrator);

    return gameWithNarrator;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':gameCode/submit')
  async submitCard(
    @Param('gameCode') gameCode: string,
    @Body() body: { playerId: string; cardId: string }
  ) {
    const { playerId, cardId } = body;
    this.logger.log(`➡️ submitCard gameCode=${gameCode} playerId=${playerId} cardId=${cardId}`);

    // 1. Buscar juego y ronda actual
    const game = await this.gamesService.findByCode(gameCode) as GameWithRelations | null;
    if (!game) {
      throw new Error('Juego no encontrado');
    }

    const currentRound = await this.prisma.round.findFirst({
      where: { gameId: game.id },
      orderBy: { number: 'desc' },
    });
    if (!currentRound) throw new Error('No hay ronda activa');

    // Evitar que el narrador envíe carta aquí
    if (currentRound.narratorId === playerId) {
      throw new Error('El narrador no puede enviar carta en esta fase');
    }

    // 2. Registrar submission en memoria (futuro: persistir en DB)
    const key = currentRound.id;
    if (!submissionsMap[key]) submissionsMap[key] = [];

    // Evitar submissions duplicadas
    if (submissionsMap[key].some(s => s.playerId === playerId)) {
      throw new Error('Este jugador ya envió su carta');
    }

    submissionsMap[key].push({ playerId, cardId });

    // 3. Comprobar si todos los jugadores (excepto narrador) han enviado carta
    const totalNonNarrators = (game.players?.length || 0) - 1;
    const allSubmitted = submissionsMap[key].length >= totalNonNarrators;

    let updatedGame = game as GameWithRelations;
    if (allSubmitted) {
      // Pasar el juego a la fase "vote"
      await this.gamesService.update(game.id, { stage: 'vote' });
      updatedGame = await this.gamesService.findByCode(gameCode) as GameWithRelations;
    }

    // 4. Construir respuesta con submissions actuales
    const gameWithData: any = {
      ...updatedGame,
      narratorId: currentRound.narratorId,
      submissions: submissionsMap[key],
    };

    // 5. Notificar a los jugadores via WS
    this.wsGateway.server.to(gameCode).emit('game_update', gameWithData);

    return gameWithData;
  }

} 