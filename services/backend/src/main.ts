import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers (spec §66).
  app.use(helmet());

  // Graceful shutdown so in-flight work + DB connections close cleanly.
  app.enableShutdownHooks();

  // /api/v1/* URI versioning (spec §8). Ops probes stay unversioned at root.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validate + strip unknown fields on every request (spec §8, §66).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', config.get<string>('CORS_ORIGIN', '')],
    credentials: true,
  });

  // OpenAPI/Swagger at /api/docs (spec §8, §89).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MyStore Platform API')
    .setDescription('Universal Enterprise Business Platform — vertical slice')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API ready on http://localhost:${port}/api/v1`);
  logger.log(`Health: /health · Ready: /ready · Metrics: /metrics · Docs: /api/docs`);
}

void bootstrap();
