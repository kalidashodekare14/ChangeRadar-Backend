/** Transaction-local context used by TenantDb (ARCHITECTURE §8.2). */
export interface TenantContext {
  /** Active workspace (tenant). Empty when creating a workspace. */
  workspaceId?: string;
  /** Authenticated user, used for membership-scoped reads. */
  userId?: string;
  /** Token hash for invitation preview before membership. */
  invitationTokenHash?: string;
}

/** Context for business operations that must be scoped to a workspace. */
export interface RequiredTenantContext extends TenantContext {
  workspaceId: string;
}
