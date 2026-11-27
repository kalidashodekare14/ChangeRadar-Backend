import { Prisma } from '../../generated/prisma/client';
import { TenantDb } from './tenant-db';

import { RequiredTenantContext } from './tenant-context';

/**
 * Base class for future tenant-scoped repositories. It refuses to run without
 * a workspace and always merges workspaceId into Prisma `where`/`create` data.
 */
export abstract class TenantRepository {
  protected constructor(protected readonly tenantDb: TenantDb) {}

  protected async inTenant<T>(
    ctx: RequiredTenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!ctx.workspaceId) {
      throw new Error('TenantRepository requires a workspace context');
    }
    return this.tenantDb.run(ctx, fn);
  }

  /** Merge the tenant key into a filter; callers cannot omit it by accident. */
  protected scopedWhere<T extends object>(
    ctx: RequiredTenantContext,
    where: T = {} as T,
  ): T & { workspaceId: string } {
    return { ...where, workspaceId: ctx.workspaceId };
  }
}
