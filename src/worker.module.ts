import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [AppConfigModule, LoggingModule.forRoot(), DatabaseModule],
})
export class WorkerModule {}
