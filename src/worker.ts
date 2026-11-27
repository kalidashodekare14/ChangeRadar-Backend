import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppConfigService } from './config/app-config.service';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  const config = app.get(AppConfigService);

  logger.log(`ChangeRadar worker ready (AI provider: ${config.get('AI_PROVIDER')})`);

  const keepAlive = setInterval(() => undefined, 60_000);
  await new Promise<void>((resolve) => {
    process.once('SIGTERM', resolve);
    process.once('SIGINT', resolve);
  });

  clearInterval(keepAlive);
  logger.log('ChangeRadar worker shutting down');
  await app.close();
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Worker failed to start: ${message}\n`);
  process.exit(1);
});
