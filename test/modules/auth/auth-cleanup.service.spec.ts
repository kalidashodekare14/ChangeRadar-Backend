import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { AuthCleanupService } from '../../../src/modules/auth/auth-cleanup.service';

describe('AuthCleanupService', () => {
  it('deletes expired sessions in batches until none remain', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'one' }, { id: 'two' }])
      .mockResolvedValueOnce([{ id: 'three' }])
      .mockResolvedValueOnce([]);
    const deleteMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = {
      session: {
        findMany: jest.fn().mockImplementation((args) => findMany(args)),
        deleteMany: jest.fn().mockImplementation((args) => deleteMany(args)),
      },
    } as unknown as PrismaService;
    const service = new AuthCleanupService(prisma);

    await expect(service.deleteExpiredSessions(new Date('2026-01-01'), 2)).resolves.toBe(3);
    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expiresAt: { lt: new Date('2026-01-01') } }, take: 2 }),
    );
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it('returns zero when there is nothing to clean', async () => {
    const prisma = {
      session: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    } as unknown as PrismaService;
    await expect(new AuthCleanupService(prisma).deleteExpiredSessions()).resolves.toBe(0);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
