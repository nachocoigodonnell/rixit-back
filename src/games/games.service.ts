import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Game } from '@prisma/client';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async create(data: { code: string; stage?: string }): Promise<Game> {
    try {
      console.log("Creando juego con datos:", data);
      
      // Crear juego usando Prisma
      const game = await this.prisma.game.create({
        data: {
          code: data.code,
          stage: data.stage || 'lobby',
        }
      });
      
      console.log("Juego creado:", game);
      
      // Verificar que se guardó correctamente
      const verifyGame = await this.findByCode(data.code);
      console.log("Verificación del juego:", verifyGame);
      
      return game;
    } catch (error) {
      console.error("Error al crear juego:", error);
      throw error;
    }
  }

  async findAll(): Promise<Game[]> {
    return this.prisma.game.findMany();
  }

  async findOne(id: string): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { code },
      include: {
        players: true,
        rounds: true,
      },
    });
  }

  async update(id: string, data: Partial<Game>): Promise<Game> {
    return this.prisma.game.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Game> {
    return this.prisma.game.delete({
      where: { id },
    });
  }
} 