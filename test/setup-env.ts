// Deterministic environment for unit/bootstrap tests (CI has no .env file).
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

// DB-backed tests use the local .env when present; CI injects its own URLs.
// This must happen here because ConfigModule validates env at import time.
if (process.env.RUN_DB_TESTS === 'true') {
  try {
    const local = parse(readFileSync('.env', 'utf8'));
    if (local.DATABASE_URL) process.env.DATABASE_URL = local.DATABASE_URL;
    if (local.DIRECT_DATABASE_URL) process.env.DIRECT_DATABASE_URL = local.DIRECT_DATABASE_URL;
  } catch {
    // No .env file — injected environment remains authoritative.
  }
}

process.env.NODE_ENV ??= 'test';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/changeradar';
process.env.DIRECT_DATABASE_URL ??= 'postgresql://test:test@localhost:5433/changeradar';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.S3_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_PUBLIC_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_REGION ??= 'us-east-1';
process.env.S3_BUCKET ??= 'changeradar';
process.env.S3_ACCESS_KEY_ID ??= 'test';
process.env.S3_SECRET_ACCESS_KEY ??= 'test';
process.env.S3_FORCE_PATH_STYLE ??= 'true';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.ACCESS_TOKEN_TTL_MINUTES ??= '15';
process.env.SESSION_TTL_DAYS ??= '30';
process.env.UPLOAD_TOKEN_SECRET ??= 'test-upload-secret';
process.env.MAX_UPLOAD_BYTES ??= '10485760';
process.env.AI_PROVIDER ??= 'fake';
process.env.AI_MODEL ??= 'fake-model';
process.env.AI_MAX_CHANGES ??= '50';
process.env.AI_DAILY_LIMIT_PER_WORKSPACE ??= '20';
process.env.AI_GLOBAL_DAILY_LIMIT ??= '200';
process.env.WORKER_CONCURRENCY_EXTRACTION ??= '2';
process.env.WORKER_CONCURRENCY_COMPARISON ??= '2';
process.env.WORKER_CONCURRENCY_AI ??= '1';
process.env.DEMO_ENABLED ??= 'false';
process.env.DEMO_RATE_LIMIT_PER_HOUR ??= '10';
process.env.DEMO_MAX_ACTIVE ??= '50';
process.env.SWAGGER_ENABLED ??= 'false';
process.env.LOG_LEVEL ??= 'silent';
process.env.TRUST_PROXY_HOPS ??= '0';
