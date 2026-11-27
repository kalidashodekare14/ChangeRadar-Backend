import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

/**
 * A client that can execute queries: the shared service or a transaction
 * client handed out by PrismaService. Repositories never import the generated
 * client themselves (CI guard); they use these aliases instead (§8.3).
 */
export type DbClient = PrismaService | Prisma.TransactionClient;
export type DbTransaction = Prisma.TransactionClient;
