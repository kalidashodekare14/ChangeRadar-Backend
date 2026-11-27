/**
 * Apply the manual SQL migrations (helpers, RLS, CHECKs, grants) in order.
 * Uses DIRECT_DATABASE_URL (the migrator role) and is safe to re-run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const url = process.env.DIRECT_DATABASE_URL;
if (!url) {
  throw new Error('DIRECT_DATABASE_URL is required to apply manual migrations');
}

const files = [
  '0001_context_helpers.sql',
  '0002_rls.sql',
  '0003_check_constraints.sql',
  '0004_grants.sql',
];

async function main(): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(join(__dirname, '..', '..', 'prisma', 'manual', file), 'utf8');
      await client.query(sql);
      process.stdout.write(`Applied ${file}\n`);
    }
  } finally {
    await client.end();
  }
}

void main();
