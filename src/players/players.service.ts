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
      
      return await this.prisma.player.create({
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