import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { configureApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  const config = app.get(AppConfigService);
  app.enableShutdownHooks();
  await app.listen(config.get('PORT'));
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Logger is not available yet if configuration validation failed.
  process.stderr.write(`API failed to start: ${message}\n`);
  process.exit(1);
});
