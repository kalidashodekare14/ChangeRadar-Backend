import { HealthProbe } from '../../src/modules/health/health-probe';
import { HealthService } from '../../src/modules/health/health.service';

function probe(name: HealthProbe['name'], up: boolean): HealthProbe {
  return { name, check: async () => up };
}

describe('HealthService', () => {
  const probes = [probe('database', true), probe('redis', true), probe('storage', true)];

  it('reports liveness without touching dependencies', () => {
    const service = new HealthService(probes);
    expect(service.liveness()).toEqual({ status: 'ok' });
  });

  it('reports readiness when every dependency is available', async () => {
    const service = new HealthService(probes);
    expect(await service.readiness()).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up', storage: 'up' },
    });
  });

  it('reports each failing dependency', async () => {
    const service = new HealthService([
      probe('database', false),
      probe('redis', true),
      probe('storage', false),
    ]);
    expect(await service.readiness()).toEqual({
      status: 'error',
      checks: { database: 'down', redis: 'up', storage: 'down' },
    });
  });
});
