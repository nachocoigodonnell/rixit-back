import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Para que esté disponible en toda la aplicación
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {} 