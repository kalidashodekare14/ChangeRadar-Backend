import { validateEnv } from '../../src/config/env.schema';

describe('environment validation', () => {
  it('accepts the documented local defaults', () => {
    expect(() => validateEnv(process.env)).not.toThrow();
    const env = validateEnv(process.env);
    expect(env.PORT).toBe(4000);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('coerces numbers and booleans', () => {
    const env = validateEnv({
      ...process.env,
      PORT: '4100',
      TRUST_PROXY_HOPS: '2',
      SWAGGER_ENABLED: 'true',
      DEMO_ENABLED: 'true',
    });
    expect(env.PORT).toBe(4100);
    expect(env.TRUST_PROXY_HOPS).toBe(2);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.DEMO_ENABLED).toBe(true);
  });

  it.each([
    ['PORT', 'not-a-number'],
    ['TRUST_PROXY_HOPS', '-1'],
    ['S3_FORCE_PATH_STYLE', 'yes'],
    ['DATABASE_URL', ''],
    ['LOG_LEVEL', 'verbose'],
  ])('fails fast on invalid %s', (key, value) => {
    expect(() => validateEnv({ ...process.env, [key]: value })).toThrow(new RegExp(key));
  });
});
