import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 CLI configuration (auto-discovered as `prisma7.config.ts`).
 *
 * The CLI/migrator uses DIRECT_DATABASE_URL (changeradar_migrator, DDL).
 * The API/Worker use DATABASE_URL (changeradar_app) through the pg adapter
 * at runtime; see src/infrastructure/database/prisma.service.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npm run db:seed',
  },
  datasource: {
    url: env('DIRECT_DATABASE_URL'),
  },
});
