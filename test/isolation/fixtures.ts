import { Client } from 'pg';

export const IDS = {
  userA: '10000000-0000-4000-8000-000000000001',
  userB: '10000000-0000-4000-8000-000000000002',
  workspaceA: '10000000-0000-4000-8000-000000000011',
  workspaceB: '10000000-0000-4000-8000-000000000012',
  documentA: '10000000-0000-4000-8000-000000000021',
  documentB: '10000000-0000-4000-8000-000000000022',
  fileA: '10000000-0000-4000-8000-000000000031',
  fileB: '10000000-0000-4000-8000-000000000032',
  versionA1: '10000000-0000-4000-8000-000000000041',
  versionA2: '10000000-0000-4000-8000-000000000042',
  versionB1: '10000000-0000-4000-8000-000000000043',
  runA: '10000000-0000-4000-8000-000000000051',
  changeA: '10000000-0000-4000-8000-000000000061',
  evidenceA: '10000000-0000-4000-8000-000000000071',
} as const;

export interface Context {
  workspaceId?: string;
  userId?: string;
  invitationTokenHash?: string;
}

/** Mirrors TenantDb: transaction-local set_config, never session-level SET. */
export async function inContext<T>(client: Client, ctx: Context, fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.current_workspace_id', $1, true)", [
      ctx.workspaceId ?? '',
    ]);
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [ctx.userId ?? '']);
    await client.query("SELECT set_config('app.invitation_token_hash', $1, true)", [
      ctx.invitationTokenHash ?? '',
    ]);
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Seed fixtures through the migrator role; tenant rows get explicit context. */
export async function seedFixtures(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO users (id, name, email, password_hash) VALUES
       ($1, 'Iso A', 'iso-a@example.com', 'x'), ($2, 'Iso B', 'iso-b@example.com', 'x')
     ON CONFLICT (id) DO NOTHING`,
    [IDS.userA, IDS.userB],
  );

  await inContext(client, { workspaceId: IDS.workspaceA, userId: IDS.userA }, async () => {
    await client.query(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES
         ($1, 'Iso Workspace A', 'iso-a', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [IDS.workspaceA],
    );
    await client.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES ($1, $2, $3, 'OWNER')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      ['20000000-0000-4000-8000-000000000001', IDS.workspaceA, IDS.userA],
    );
  });

  await inContext(client, { workspaceId: IDS.workspaceB, userId: IDS.userB }, async () => {
    await client.query(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES
         ($1, 'Iso Workspace B', 'iso-b', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [IDS.workspaceB],
    );
    await client.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES ($1, $2, $3, 'OWNER')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      ['20000000-0000-4000-8000-000000000002', IDS.workspaceB, IDS.userB],
    );
  });

  for (const [workspaceId, documentId, fileId, userId] of [
    [IDS.workspaceA, IDS.documentA, IDS.fileA, IDS.userA],
    [IDS.workspaceB, IDS.documentB, IDS.fileB, IDS.userB],
  ] as const) {
    await inContext(client, { workspaceId, userId }, async () => {
      await client.query(
        `INSERT INTO documents (id, workspace_id, title, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [documentId, workspaceId, `Doc ${workspaceId}`, userId],
      );
      await client.query(
        `INSERT INTO stored_files
           (id, workspace_id, storage_provider, bucket_name, storage_key, original_filename,
            mime_type, file_extension, file_size, checksum_sha256, status, created_by)
         VALUES ($1, $2, 's3', 'changeradar', $3, 'doc.txt', 'text/plain', 'txt', 10, $4, 'AVAILABLE', $5)
         ON CONFLICT (id) DO NOTHING`,
        [fileId, workspaceId, `iso/${fileId}.txt`, 'a'.repeat(64), userId],
      );
    });
  }

  await inContext(client, { workspaceId: IDS.workspaceA, userId: IDS.userA }, async () => {
    for (const [versionId, number, fileId] of [
      [IDS.versionA1, 1, IDS.fileA],
      [IDS.versionA2, 2, IDS.fileA],
    ] as const) {
      await client.query(
        `INSERT INTO document_versions
           (id, workspace_id, document_id, stored_file_id, version_number, original_filename,
            mime_type, file_size, checksum_sha256, processing_status, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, 'doc.txt', 'text/plain', 10, $6, 'COMPLETED', $7)
         ON CONFLICT (id) DO NOTHING`,
        [versionId, IDS.workspaceA, IDS.documentA, fileId, number, 'b'.repeat(64), IDS.userA],
      );
    }
    await client.query(
      `INSERT INTO comparison_runs
         (id, workspace_id, document_id, source_version_id, target_version_id, status, engine_version, created_by)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED', '1.0.0', $6)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.runA, IDS.workspaceA, IDS.documentA, IDS.versionA1, IDS.versionA2, IDS.userA],
    );
    await client.query(
      `INSERT INTO comparison_changes
         (id, workspace_id, comparison_run_id, sequence_number, category, old_text, new_text)
       VALUES ($1, $2, $3, 1, 'MODIFIED', 'old', 'new')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.changeA, IDS.workspaceA, IDS.runA],
    );
    await client.query(
      `INSERT INTO change_evidence
         (id, workspace_id, comparison_change_id, evidence_type, source_version_id)
       VALUES ($1, $2, $3, 'TARGET_BLOCK', $4)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.evidenceA, IDS.workspaceA, IDS.changeA, IDS.versionA2],
    );
  });

  await inContext(client, { workspaceId: IDS.workspaceB, userId: IDS.userB }, async () => {
    await client.query(
      `INSERT INTO document_versions
         (id, workspace_id, document_id, stored_file_id, version_number, original_filename,
          mime_type, file_size, checksum_sha256, processing_status, uploaded_by)
       VALUES ($1, $2, $3, $4, 1, 'doc.txt', 'text/plain', 10, $5, 'COMPLETED', $6)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.versionB1, IDS.workspaceB, IDS.documentB, IDS.fileB, 'c'.repeat(64), IDS.userB],
    );
  });
}
