import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  const express = app.getHttpAdapter().getInstance() as {
    set(name: string, value: unknown): void;
  };
  express.set('trust proxy', config.get('TRUST_PROXY_HOPS'));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  if (config.get('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('ChangeRadar API').setVersion('1.0').build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
  await app.listen(config.get('PORT'));
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Logger is not available yet if configuration validation failed.
  process.stderr.write(`API failed to start: ${message}\n`);
  process.exit(1);
});
