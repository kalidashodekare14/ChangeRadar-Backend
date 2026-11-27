import { Inject, Injectable } from '@nestjs/common';
import { HEALTH_PROBES, HealthComponent, HealthProbe } from './health-probe';

export type HealthStatus = 'ok' | 'error';
export type DependencyStatus = 'up' | 'down';

export interface ReadinessResult {
  status: HealthStatus;
  checks: Record<HealthComponent, DependencyStatus>;
}

@Injectable()
export class HealthService {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: HealthProbe[]) {}

  liveness(): { status: HealthStatus } {
    return { status: 'ok' };
  }

  async readiness(): Promise<ReadinessResult> {
    const entries = await Promise.all(
      this.probes.map(async (probe): Promise<[HealthComponent, DependencyStatus]> => [
        probe.name,
        (await probe.check()) ? 'up' : 'down',
      ]),
    );
    const checks = Object.fromEntries(entries) as Record<HealthComponent, DependencyStatus>;
    const status = Object.values(checks).every((value) => value === 'up') ? 'ok' : 'error';
    return { status, checks };
  }
}
