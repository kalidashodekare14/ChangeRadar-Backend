/**
 * Idempotent development seed (ARCHITECTURE §29). Never contains production
 * secrets; the password hash below is for a documented dev-only account.
 * Global rows are created directly; tenant rows go through TenantDb so RLS
 * context is set exactly as in the application.
 */
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TenantDb } from '../src/infrastructure/database/tenant-db';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to seed');

const DEV_EMAIL = 'dev@example.com';
// argon2id hash of "ChangerRadar-dev-only" — development only, never used in staging/production.
const DEV_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$PFTD+wAYrFvlGEj20XN3PQ$iipJIuwNYuSDWrP/Qm9LTIqZ8SvduUv+yKR3FQ+izqQ';

const IDS = {
  userA: '00000000-0000-4000-8000-000000000001',
  userB: '00000000-0000-4000-8000-000000000002',
  workspaceA: '00000000-0000-4000-8000-000000000011',
  workspaceB: '00000000-0000-4000-8000-000000000012',
  documentA: '00000000-0000-4000-8000-000000000021',
  documentB: '00000000-0000-4000-8000-000000000022',
  fileA: '00000000-0000-4000-8000-000000000031',
  fileB: '00000000-0000-4000-8000-000000000032',
  versionA: '00000000-0000-4000-8000-000000000041',
  versionB: '00000000-0000-4000-8000-000000000042',
  run: '00000000-0000-4000-8000-000000000051',
  change: '00000000-0000-4000-8000-000000000061',
  evidence: '00000000-0000-4000-8000-000000000071',
} as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const tenantDb = new TenantDb(prisma as unknown as PrismaService);

  try {
    // Global identity: no workspace RLS.
    await prisma.user.upsert({
      where: { id: IDS.userA },
      create: {
        id: IDS.userA,
        name: 'Dev Owner',
        email: DEV_EMAIL,
        passwordHash: DEV_PASSWORD_HASH,
      },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: IDS.userB },
      create: {
        id: IDS.userB,
        name: 'Dev Member',
        email: 'member@example.com',
        passwordHash: DEV_PASSWORD_HASH,
      },
      update: {},
    });

    for (const [workspaceId, ownerId, name, slug] of [
      [IDS.workspaceA, IDS.userA, 'Alpha Workspace', 'alpha-workspace'],
      [IDS.workspaceB, IDS.userB, 'Beta Workspace', 'beta-workspace'],
    ] as const) {
      await tenantDb.run({ workspaceId, userId: ownerId }, async (tx) => {
        const now = new Date();
        await tx.workspace.upsert({
          where: { id: workspaceId },
          create: { id: workspaceId, name, slug, createdAt: now, updatedAt: now },
          update: {},
        });
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId, userId: ownerId } },
          create: { id: randomUUID(), workspaceId, userId: ownerId, role: 'OWNER' },
          update: {},
        });
      });
    }

    await tenantDb.run({ workspaceId: IDS.workspaceA, userId: IDS.userA }, async (tx) => {
      await tx.document.upsert({
        where: { id: IDS.documentA },
        create: {
          id: IDS.documentA,
          workspaceId: IDS.workspaceA,
          title: 'Demo agreement v1',
          createdBy: IDS.userA,
        },
        update: {},
      });
      await tx.storedFile.upsert({
        where: { id: IDS.fileA },
        create: {
          id: IDS.fileA,
          workspaceId: IDS.workspaceA,
          storageProvider: 's3',
          bucketName: 'changeradar',
          storageKey: 'seed/demo-agreement-v1.txt',
          originalFilename: 'demo-agreement.txt',
          mimeType: 'text/plain',
          fileExtension: 'txt',
          fileSize: 120n,
          checksumSha256: '0'.repeat(64),
          status: 'AVAILABLE',
          createdBy: IDS.userA,
        },
        update: {},
      });
      await tx.documentVersion.upsert({
        where: { id: IDS.versionA },
        create: {
          id: IDS.versionA,
          workspaceId: IDS.workspaceA,
          documentId: IDS.documentA,
          storedFileId: IDS.fileA,
          versionNumber: 1,
          originalFilename: 'demo-agreement.txt',
          mimeType: 'text/plain',
          fileSize: 120n,
          checksumSha256: '0'.repeat(64),
          processingStatus: 'COMPLETED',
          uploadedBy: IDS.userA,
          extractedText: 'The fee is 100 USD.',
        },
        update: {},
      });
      await tx.documentVersion.upsert({
        where: { id: IDS.versionB },
        create: {
          id: IDS.versionB,
          workspaceId: IDS.workspaceA,
          documentId: IDS.documentA,
          storedFileId: IDS.fileA,
          versionNumber: 2,
          originalFilename: 'demo-agreement.txt',
          mimeType: 'text/plain',
          fileSize: 128n,
          checksumSha256: '1'.repeat(64),
          processingStatus: 'COMPLETED',
          uploadedBy: IDS.userA,
          extractedText: 'The fee is 150 USD.',
        },
        update: {},
      });

      if (!(await tx.comparisonRun.findUnique({ where: { id: IDS.run } }))) {
        await tx.comparisonRun.create({
          data: {
            id: IDS.run,
            workspaceId: IDS.workspaceA,
            documentId: IDS.documentA,
            sourceVersionId: IDS.versionA,
            targetVersionId: IDS.versionB,
            status: 'COMPLETED',
            engineVersion: '1.0.0',
            createdBy: IDS.userA,
            completedAt: new Date(),
          },
        });
      }
      // Insert-only tables: use find-then-create, never upsert (no UPDATE grant).
      if (!(await tx.comparisonChange.findUnique({ where: { id: IDS.change } }))) {
        await tx.comparisonChange.create({
          data: {
            id: IDS.change,
            workspaceId: IDS.workspaceA,
            comparisonRunId: IDS.run,
            sequenceNumber: 1,
            category: 'MODIFIED',
            severity: 'MEDIUM',
            oldText: 'The fee is 100 USD.',
            newText: 'The fee is 150 USD.',
            fingerprint: 'seed-fingerprint',
          },
        });
      }
      if (!(await tx.changeEvidence.findUnique({ where: { id: IDS.evidence } }))) {
        await tx.changeEvidence.create({
          data: {
            id: IDS.evidence,
            workspaceId: IDS.workspaceA,
            comparisonChangeId: IDS.change,
            evidenceType: 'TARGET_BLOCK',
            sourceVersionId: IDS.versionB,
            excerpt: 'The fee is 150 USD.',
          },
        });
      }
    });

    await tenantDb.run({ workspaceId: IDS.workspaceB, userId: IDS.userB }, async (tx) => {
      await tx.document.upsert({
        where: { id: IDS.documentB },
        create: {
          id: IDS.documentB,
          workspaceId: IDS.workspaceB,
          title: 'Beta workspace document',
          createdBy: IDS.userB,
        },
        update: {},
      });
    });

    process.stdout.write('Seed complete (idempotent).\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
