import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Removes expired sessions from the global table. Designed here; Phase 6 wires
 * it into the Worker's maintenance schedule (§21).
 */
@Injectable()
export class AuthCleanupService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteExpiredSessions(now: Date = new Date(), batchSize = 500): Promise<number> {
    let deleted = 0;
    for (;;) {
      const batch = await this.prisma.session.findMany({
        where: { expiresAt: { lt: now } },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) return deleted;
      deleted += (
        await this.prisma.session.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } })
      ).count;
      if (batch.length < batchSize) return deleted;
    }
  }
}
