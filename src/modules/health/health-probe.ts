export type HealthComponent = 'database' | 'redis' | 'storage';

export interface HealthProbe {
  readonly name: HealthComponent;
  check(): Promise<boolean>;
}

export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
