import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbConfig = {
          type: 'postgres' as const,
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
        };
        
        console.log('CONFIGURACIÓN DB:', {
          type: dbConfig.type,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          database: dbConfig.database,
          autoLoadEntities: dbConfig.autoLoadEntities,
          synchronize: dbConfig.synchronize,
        });
        
        return dbConfig;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {} 