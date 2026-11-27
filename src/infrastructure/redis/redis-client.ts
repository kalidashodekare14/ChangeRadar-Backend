import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Shared ioredis client. Connects on first use so unit tests that only compile
 * modules do not require a running Redis instance.
 */
@Injectable()
export class RedisClient implements OnApplicationShutdown {
  readonly client: Redis;

  constructor(config: AppConfigService) {
    this.client = new Redis(config.get('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    // A missing Redis must not crash the process with an unhandled error event.
    this.client.on('error', () => undefined);
  }

  async ping(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.client.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit().catch(() => undefined);
    }
  }
}
