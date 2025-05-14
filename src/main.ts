import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // CORS para HTTP y long-polling de Socket.IO
  app.enableCors({
    origin: ['http://localhost:8844', 'http://127.0.0.1:8844'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 8899;
  await app.listen(port, () =>
    logger.log(`🚀 Servidor escuchando en http://localhost:${port}`),
  );
}
bootstrap(); 