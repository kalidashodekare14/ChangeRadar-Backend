import { TenantDb } from '../../../src/infrastructure/database/tenant-db';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';

type Tx = { $executeRaw: jest.Mock };

function makeTenantDb(): {
  tenantDb: TenantDb;
  transaction: jest.Mock;
  executeRaw: Tx['$executeRaw'];
} {
  const executeRaw = jest.fn().mockResolvedValue(undefined);
  const tx: Tx = { $executeRaw: executeRaw };
  const transaction = jest
    .fn()
    .mockImplementation(async (fn: (client: Tx) => Promise<unknown>) => fn(tx));
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  return { tenantDb: new TenantDb(prisma), transaction, executeRaw };
}

describe('TenantDb', () => {
  it('sets all three context values transaction-locally and returns the callback result', async () => {
    const { tenantDb, transaction, executeRaw } = makeTenantDb();
    const result = await tenantDb.run(
      { workspaceId: 'ws-1', userId: 'user-1', invitationTokenHash: 'hash-1' },
      async () => 'done',
    );

    type Call = [TemplateStringsArray, ...string[]];
    const calls = executeRaw.mock.calls as Call[];
    expect(result).toBe('done');
    expect(executeRaw).toHaveBeenCalledTimes(3);
    expect(calls.map((call) => call[1])).toEqual(['ws-1', 'user-1', 'hash-1']);
    expect(calls.every((call) => String(call[0]).includes('true'))).toBe(true);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 10_000 });
  });

  it('clears context values that are absent', async () => {
    const { tenantDb, executeRaw } = makeTenantDb();
    await tenantDb.run({}, async () => undefined);
    const calls = executeRaw.mock.calls as Array<[TemplateStringsArray, ...string[]]>;
    expect(calls.map((call) => call[1])).toEqual(['', '', '']);
  });

  it('propagates errors so the transaction rolls back the context', async () => {
    const { tenantDb } = makeTenantDb();
    await expect(
      tenantDb.run({ workspaceId: 'ws-1' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
