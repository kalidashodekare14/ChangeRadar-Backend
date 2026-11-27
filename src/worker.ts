import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('Worker');
  logger.log('ChangeRadar worker ready');

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
  const logger = new Logger('Worker');
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(
    `Worker failed to start: ${message}`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
