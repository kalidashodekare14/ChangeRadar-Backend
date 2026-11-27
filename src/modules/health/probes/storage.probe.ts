import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { HealthProbe } from '../health-probe';

/**
 * Availability probe only: any HTTP response means the S3 endpoint is up.
 * Authenticated bucket checks arrive with the storage adapter in Phase 5.
 */
@Injectable()
export class StorageProbe implements HealthProbe {
  readonly name = 'storage' as const;

  constructor(private readonly config: AppConfigService) {}

  async check(): Promise<boolean> {
    try {
      const response = await fetch(this.config.get('S3_ENDPOINT'), {
        signal: AbortSignal.timeout(2_000),
      });
      await response.body?.cancel().catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }
}
