import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggingModule } from './common/logging/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AppConfigModule } from './config/config.module';
import { RedisClient } from './infrastructure/redis/redis-client';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RedisThrottlerStorage } from './infrastructure/redis/redis-throttler.storage';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forRoot(),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisClient],
      useFactory: (redis: RedisClient) => ({
        throttlers: [{ name: 'global', limit: 300, ttl: 60, blockDuration: 60 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
