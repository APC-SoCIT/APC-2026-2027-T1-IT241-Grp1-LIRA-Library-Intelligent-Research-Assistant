import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './shared/request-logging.interceptor';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const config = app.get(ConfigService);

  app.enableCors({ origin: config.get<string[]>('app.corsOrigins', []) });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  return app;
}
