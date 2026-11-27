import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [AppConfigModule, LoggingModule.forRoot()],
})
export class WorkerModule {}
