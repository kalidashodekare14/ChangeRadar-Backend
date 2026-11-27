/**
 * Development/CI helper: create the migrator and runtime roles idempotently.
 *
 * Runs as the bootstrap superuser supplied by BOOTSTRAP_DATABASE_URL (the
 * compose Postgres user locally, or a CI service superuser). Passwords are
 * taken from MIGRATOR_PASSWORD / APP_PASSWORD and never written to disk.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const bootstrapUrl = process.env.BOOTSTRAP_DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;
const migratorPassword = process.env.MIGRATOR_PASSWORD;
const appPassword = process.env.APP_PASSWORD;

if (!bootstrapUrl || !migratorPassword || !appPassword) {
  throw new Error(
    'BOOTSTRAP_DATABASE_URL (or DIRECT_DATABASE_URL), MIGRATOR_PASSWORD and APP_PASSWORD are required',
  );
}

const escapeLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const sql = readFileSync(join(__dirname, 'create-roles.sql'), 'utf8')
  .replaceAll('__MIGRATOR_PASSWORD__', escapeLiteral(migratorPassword))
  .replaceAll('__APP_PASSWORD__', escapeLiteral(appPassword));

async function main(): Promise<void> {
  const client = new Client({ connectionString: bootstrapUrl });
  await client.connect();
  try {
    await client.query(sql);
    process.stdout.write('Roles changeradar_migrator / changeradar_app are ready.\n');
  } finally {
    await client.end();
  }
}

void main();
