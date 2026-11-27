import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'], {
    message: 'must be exactly "true" or "false"',
  })
  .transform((value) => value === 'true');

const positiveInt = z.coerce.number().int().positive();
const port = z.coerce.number().int().min(1).max(65_535);

/**
 * Every application variable from ARCHITECTURE §17. Compose-only variables
 * (POSTGRES_*, etc.) are intentionally not part of the application contract.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: port.default(4000),
  APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_PUBLIC_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString,

  JWT_ACCESS_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL_MINUTES: positiveInt,
  SESSION_TTL_DAYS: positiveInt,
  UPLOAD_TOKEN_SECRET: z.string().min(1),
  MAX_UPLOAD_BYTES: positiveInt,

  AI_PROVIDER: z.string().min(1),
  AI_MODEL: z.string().min(1),
  AI_API_KEY: z.string().default(''),
  AI_MAX_CHANGES: positiveInt,
  AI_DAILY_LIMIT_PER_WORKSPACE: positiveInt,
  AI_GLOBAL_DAILY_LIMIT: positiveInt,

  WORKER_CONCURRENCY_EXTRACTION: positiveInt,
  WORKER_CONCURRENCY_COMPARISON: positiveInt,
  WORKER_CONCURRENCY_AI: positiveInt,

  DEMO_ENABLED: booleanFromString,
  DEMO_RATE_LIMIT_PER_HOUR: positiveInt,
  DEMO_MAX_ACTIVE: positiveInt,

  SWAGGER_ENABLED: booleanFromString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(32).default(0),
});

export type Env = z.infer<typeof envSchema>;

/** Fail-fast validation for ConfigModule.forRoot({ validate }). */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
