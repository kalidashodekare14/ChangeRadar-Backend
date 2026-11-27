import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import { AppConfigService } from '../../../config/app-config.service';
import { HealthProbe } from '../health-probe';

/** Availability probe only; schema/role checks arrive with Phase 2. */
@Injectable()
export class DatabaseProbe implements HealthProbe {
  readonly name = 'database' as const;

  constructor(private readonly config: AppConfigService) {}

  async check(): Promise<boolean> {
    const client = new Client({
      connectionString: this.config.get('DATABASE_URL'),
      connectionTimeoutMillis: 2_000,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return true;
    } catch {
      return false;
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
