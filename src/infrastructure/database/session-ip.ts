import { isIP } from 'node:net';
import { DbClient } from './transaction-client';

/**
 * `sessions.ip_address` is `Unsupported("inet")`, so Prisma cannot write it.
 * This is the only place that is allowed to touch it: a tagged (parameterised)
 * raw statement in the database layer, with validation before the cast.
 */
export async function setSessionIpAddress(
  client: DbClient,
  sessionId: string,
  ip: string | null | undefined,
): Promise<void> {
  if (!ip || isIP(ip) === 0) return;
  await client.$executeRaw`UPDATE public.sessions SET ip_address = ${ip}::inet WHERE id = ${sessionId}::uuid`;
}
