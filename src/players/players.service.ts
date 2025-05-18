import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Player } from '@prisma/client';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    isHost?: boolean;
    gameId?: string;
  }): Promise<Player> {
    try {
      console.log('Creando jugador:', data);
      
      // Crear jugador
      const newPlayer = await this.prisma.player.create({
        data: {
          name: data.name,
          isHost: data.isHost || false,
          game: data.gameId ? { 
            connect: { id: data.gameId } 
          } : undefined
        },
        include: {
          game: true
        }
      });

      // Seleccionar 6 cartas aleatorias para la mano
      // @ts-ignore - propiedades dinámicas generadas por Prisma
      const allCards: any[] = await this.prisma.card.findMany();
      if (allCards.length < 6) {
        console.warn('No hay suficientes cartas en la base de datos para asignar una mano');
      }
      // Mezclar y tomar las primeras 6
      const shuffled = allCards.sort(() => 0.5 - Math.random());
      const selectedCards = shuffled.slice(0, 6).map(c => ({ id: c.id }));

      // Crear la mano y asociar cartas
      // @ts-ignore - propiedad 'hand' generada por Prisma
      await this.prisma.hand.create({
        data: {
          player: { connect: { id: newPlayer.id } },
          cards: { connect: selectedCards },
        }
      });

      return newPlayer;
    } catch (error) {
      console.error('Error al crear jugador:', error);
      throw error;
    }
  }

  async findAll(): Promise<Player[]> {
    return this.prisma.player.findMany();
  }

  async findOne(id: string): Promise<Player | null> {
    return this.prisma.player.findUnique({
      where: { id },
      include: { game: true }
    });
  }

  async update(id: string, data: Partial<Player>): Promise<Player> {
    const { game, ...rest } = data as any;
    
    return this.prisma.player.update({
      where: { id },
      data: {
        ...rest,
        game: game?.id ? {
          connect: { id: game.id }
        } : undefined
      },
      include: { game: true }
    });
  }

  async remove(id: string): Promise<Player> {
    return this.prisma.player.delete({
      where: { id }
    });
  }

  async findByGame(gameId: string): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: { gameId }
    });
  }
} 