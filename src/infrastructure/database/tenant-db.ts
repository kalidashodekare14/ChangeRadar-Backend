import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-context';

/**
 * The only access path to tenant tables (ARCHITECTURE §8.3).
 *
 * set_config's third argument `true` makes the settings transaction-local
 * (`SET LOCAL` equivalent): pooled connections cannot leak context after
 * commit/rollback. All queries inside `fn` must use the transaction client.
 */
@Injectable()
export class TenantDb {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(ctx: TenantContext, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.setContext(tx, ctx);
        return fn(tx);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * Apply tenant context to a transaction that the caller already opened.
   * Needed when a global write (e.g. creating a user) and tenant writes must
   * be atomic — the caller still cannot bypass set_config (§8.3).
   */
  async runInTransaction<T>(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    await this.setContext(tx, ctx);
    return fn(tx);
  }

  private async setContext(tx: Prisma.TransactionClient, ctx: TenantContext): Promise<void> {
    await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${ctx.workspaceId ?? ''}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId ?? ''}, true)`;
    await tx.$executeRaw`SELECT set_config('app.invitation_token_hash', ${ctx.invitationTokenHash ?? ''}, true)`;
  }
}
