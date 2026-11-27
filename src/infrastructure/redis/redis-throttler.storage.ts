import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisClient } from './redis-client';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local expires = redis.call('PTTL', KEYS[1])
local blockExpires = redis.call('PTTL', KEYS[2])
if hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  redis.call('PSETEX', KEYS[2], ARGV[3], '1')
  redis.call('DEL', KEYS[1])
  blockExpires = tonumber(ARGV[3])
end
return { hits, expires, blockExpires }
`;

/** Distributed rate-limit counter with atomic INCR/EXPIRE (§10.4). */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisClient) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const prefix = `cr:throttle:${throttlerName || 'default'}:${key}`;
    const result = (await this.redis.client.eval(
      INCREMENT_SCRIPT,
      2,
      `${prefix}:hits`,
      `${prefix}:block`,
      String(ttl * 1000),
      String(limit),
      String(blockDuration * 1000),
    )) as number[] | null;

    if (!result) {
      return { totalHits: 1, timeToExpire: ttl * 1000, isBlocked: false, timeToBlockExpire: 0 };
    }

    const [totalHits, timeToExpire, timeToBlockExpire] = result.map(Number);
    return {
      totalHits,
      timeToExpire,
      isBlocked: timeToBlockExpire > 0,
      timeToBlockExpire,
    };
  }
}
