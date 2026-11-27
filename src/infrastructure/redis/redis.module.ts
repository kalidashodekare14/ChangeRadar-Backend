import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module';
import { RedisClient } from './redis-client';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [RedisClient],
  exports: [RedisClient],
})
export class RedisModule {}
