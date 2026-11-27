import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scan } = require('../scripts/check-forbidden.js') as {
  scan: (root: string) => string[];
};

describe('check-forbidden', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cr-forbidden-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const put = (file: string, content: string): void => {
    const target = join(root, file);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  };

  it.each([
    ['session-level SET', 'app.service.ts', "const sql = 'SET app.current_workspace_id = x';"],
    ['unsafe query', 'app.service.ts', 'await prisma.$queryRawUnsafe(sql);'],
    ['unsafe execute', 'app.service.ts', 'await prisma.$executeRawUnsafe(sql);'],
    [
      'set_config outside TenantDb',
      'app.service.ts',
      "const sql = \"SELECT set_config('app.current_workspace_id', 'x', true)\";",
    ],
    [
      'direct client import',
      'app.service.ts',
      "import { PrismaClient } from '../../generated/prisma/client';",
    ],
    ['raw SQL in a module', 'modules/foo/foo.service.ts', 'await prisma.$queryRaw`SELECT 1`;'],
  ])('rejects %s', (_label, file, content) => {
    put(file, content);
    expect(scan(root)).toHaveLength(1);
  });

  it('allows TenantDb to set context with parameterized raw SQL', () => {
    put(
      'infrastructure/database/tenant-db.ts',
      "await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${id}, true)`;",
    );
    expect(scan(root)).toEqual([]);
  });

  it('allows the error mapper to import the generated client', () => {
    put(
      'common/errors/prisma-error.mapper.ts',
      "import { Prisma } from '../../generated/prisma/client';",
    );
    expect(scan(root)).toEqual([]);
  });

  it('ignores generated output and non-TypeScript files', () => {
    put('generated/prisma/client.ts', 'await prisma.$queryRawUnsafe(sql);');
    put('notes.txt', 'SET app.current_workspace_id');
    expect(scan(root)).toEqual([]);
  });
});
