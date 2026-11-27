import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { IDS, inContext, seedFixtures } from './fixtures';

// Run only when a migrated database with both roles is available (CI sets this).
const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDb('tenant isolation (runtime role, ARCHITECTURE §20)', () => {
  let migrator: Client;
  let runtime: Client;

  beforeAll(async () => {
    migrator = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
    runtime = new Client({ connectionString: process.env.DATABASE_URL });
    await migrator.connect();
    await runtime.connect();
    await seedFixtures(migrator);
  });

  afterAll(async () => {
    await migrator?.end();
    await runtime?.end();
  });

  const count = async (client: Client, sql: string, params: unknown[]): Promise<number> => {
    const result = await client.query(sql, params);
    return Number(result.rowCount ?? 0);
  };

  it('1. workspace A cannot read B documents', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA, userId: IDS.userA }, async () => {
      expect(await count(runtime, 'SELECT id FROM documents WHERE id = $1', [IDS.documentB])).toBe(
        0,
      );
      expect(await count(runtime, 'SELECT id FROM documents WHERE id = $1', [IDS.documentA])).toBe(
        1,
      );
    });
  });

  it('2. workspace A cannot update B documents', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA }, async () => {
      expect(
        await count(runtime, "UPDATE documents SET title = 'hacked' WHERE id = $1", [
          IDS.documentB,
        ]),
      ).toBe(0);
    });
    await inContext(migrator, { workspaceId: IDS.workspaceB }, async () => {
      const result = await migrator.query<{ title: string }>(
        'SELECT title FROM documents WHERE id = $1',
        [IDS.documentB],
      );
      expect(result.rows[0].title).not.toBe('hacked');
    });
  });

  it('3. workspace A cannot delete B documents', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA }, async () => {
      expect(await count(runtime, 'DELETE FROM documents WHERE id = $1', [IDS.documentB])).toBe(0);
    });
  });

  it('4. workspace A cannot reference B document versions (composite FK)', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA, userId: IDS.userA }, async () => {
      await expect(
        runtime.query(
          `INSERT INTO comparison_runs
             (id, workspace_id, document_id, source_version_id, target_version_id, status, engine_version, created_by)
           VALUES ($1, $2, $3, $4, $5, 'QUEUED', '1.0.0', $6)`,
          [randomUUID(), IDS.workspaceA, IDS.documentA, IDS.versionB1, IDS.versionA2, IDS.userA],
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('9. missing tenant context exposes no tenant rows', async () => {
    expect(await count(runtime, 'SELECT id FROM documents', [])).toBe(0);
    // Global tables are the documented exception.
    expect(await count(runtime, 'SELECT id FROM users', [])).toBeGreaterThan(0);
  });

  it('10. a pooled connection does not leak context from a previous transaction', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA }, async () => {
      expect(await count(runtime, 'SELECT id FROM documents', [])).toBeGreaterThan(0);
    });
    const setting = await runtime.query<{ ws: string | null }>(
      "SELECT current_setting('app.current_workspace_id', true) AS ws",
    );
    // A previous transaction may leave an empty (not NULL) session value;
    // app_current_workspace_id() uses NULLIF so both fail closed.
    expect(['', null]).toContain(setting.rows[0].ws);
    await runtime.query('BEGIN');
    expect(await count(runtime, 'SELECT id FROM documents', [])).toBe(0);
    await runtime.query('COMMIT');
  });

  it('11. parameterized raw SQL obeys the same RLS policies', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA }, async () => {
      expect(await count(runtime, 'SELECT id FROM documents WHERE id = $1', [IDS.documentB])).toBe(
        0,
      );
    });
  });

  it('12. cross-workspace composite foreign keys fail', async () => {
    await inContext(runtime, { workspaceId: IDS.workspaceA, userId: IDS.userA }, async () => {
      await expect(
        runtime.query(
          `INSERT INTO document_versions
             (id, workspace_id, document_id, stored_file_id, version_number, original_filename,
              mime_type, file_size, checksum_sha256, uploaded_by)
           VALUES ($1, $2, $3, $4, 99, 'doc.txt', 'text/plain', 10, $5, $6)`,
          [randomUUID(), IDS.workspaceA, IDS.documentB, IDS.fileA, 'd'.repeat(64), IDS.userA],
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('13. runtime role is not superuser and cannot bypass RLS', async () => {
    const result = await migrator.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
      ['changeradar_app'],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].rolsuper).toBe(false);
    expect(result.rows[0].rolbypassrls).toBe(false);
  });

  it('14. immutable columns cannot be updated', async () => {
    // Each failing statement needs its own transaction: a permission error
    // aborts the transaction, so later statements would return 25P02.
    await expect(
      inContext(runtime, { workspaceId: IDS.workspaceA }, () =>
        runtime.query("UPDATE comparison_changes SET new_text = 'x' WHERE id = $1", [IDS.changeA]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      inContext(runtime, { workspaceId: IDS.workspaceA }, () =>
        runtime.query("UPDATE change_evidence SET excerpt = 'x' WHERE id = $1", [IDS.evidenceA]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      inContext(runtime, { workspaceId: IDS.workspaceA }, () =>
        runtime.query('UPDATE document_versions SET version_number = 99 WHERE id = $1', [
          IDS.versionA1,
        ]),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    // The three permitted columns remain writable.
    await inContext(runtime, { workspaceId: IDS.workspaceA }, async () => {
      expect(
        await count(runtime, "UPDATE document_versions SET extracted_text = 'ok' WHERE id = $1", [
          IDS.versionA1,
        ]),
      ).toBe(1);
    });
  });
});
