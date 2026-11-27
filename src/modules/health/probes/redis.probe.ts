import { Injectable } from '@nestjs/common';
import { RedisClient } from '../../../infrastructure/redis/redis-client';
import { HealthProbe } from '../health-probe';

@Injectable()
export class RedisProbe implements HealthProbe {
  readonly name = 'redis' as const;

  constructor(private readonly redis: RedisClient) {}

  async check(): Promise<boolean> {
    if (this.redis.client.status === 'end') return false;
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
