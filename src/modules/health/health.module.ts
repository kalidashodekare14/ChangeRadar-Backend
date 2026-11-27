import { Module } from '@nestjs/common';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { HEALTH_PROBES, HealthProbe } from './health-probe';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseProbe } from './probes/database.probe';
import { RedisProbe } from './probes/redis.probe';
import { StorageProbe } from './probes/storage.probe';

@Module({
  imports: [RedisModule],
  controllers: [HealthController],
  providers: [
    DatabaseProbe,
    RedisProbe,
    StorageProbe,
    {
      provide: HEALTH_PROBES,
      inject: [DatabaseProbe, RedisProbe, StorageProbe],
      useFactory: (...probes: HealthProbe[]) => probes,
    },
    HealthService,
  ],
  exports: [HealthService],
})
export class HealthModule {}
