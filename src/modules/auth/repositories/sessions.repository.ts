import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { setSessionIpAddress } from '../../../infrastructure/database/session-ip';
import { DbClient } from '../../../infrastructure/database/transaction-client';

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  userAgent: string | null;
  createdAt: Date;
}

/** Global `sessions` table — all writes use the runtime role via PrismaService. */
@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, client: DbClient = this.prisma): Promise<SessionRecord | null> {
    return client.session.findUnique({ where: { id } });
  }

  findByRefreshHash(hash: string, client: DbClient = this.prisma): Promise<SessionRecord | null> {
    return client.session.findUnique({ where: { refreshTokenHash: hash } });
  }

  async create(
    client: DbClient,
    data: {
      id: string;
      userId: string;
      refreshTokenHash: string;
      expiresAt: Date;
      userAgent?: string | null;
      ipAddress?: string | null;
    },
  ): Promise<SessionRecord> {
    const session = await client.session.create({
      data: {
        id: data.id,
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent?.slice(0, 500) ?? null,
      },
    });
    // ip_address is Unsupported("inet") — only the database layer may write it.
    await setSessionIpAddress(client, session.id, data.ipAddress);
    return session;
  }

  /** Conditional update: a concurrent refresh with the old hash sees 0 rows. */
  async rotate(
    client: DbClient,
    data: { id: string; oldHash: string; newHash: string; now: Date },
  ): Promise<boolean> {
    const result = await client.session.updateMany({
      where: {
        id: data.id,
        refreshTokenHash: data.oldHash,
        revokedAt: null,
        expiresAt: { gt: data.now },
      },
      data: { refreshTokenHash: data.newHash, lastUsedAt: data.now },
    });
    return result.count === 1;
  }

  async revoke(client: DbClient, id: string, userId: string, now: Date): Promise<boolean> {
    const result = await client.session.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count === 1;
  }

  revokeOthers(client: DbClient, userId: string, currentId: string, now: Date): Promise<number> {
    return client.session
      .updateMany({
        where: { userId, id: { not: currentId }, revokedAt: null },
        data: { revokedAt: now },
      })
      .then((result) => result.count);
  }

  listActive(client: DbClient, userId: string, now: Date): Promise<SessionRecord[]> {
    return client.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
