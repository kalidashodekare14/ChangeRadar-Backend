import { Injectable } from '@nestjs/common';
import { mapPrismaError } from '../../../common/errors/prisma-error.mapper';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DbClient } from '../../../infrastructure/database/transaction-client';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  isActive: boolean;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Global `users` table — no tenant context, never raw SQL. */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string, client: DbClient = this.prisma): Promise<UserRecord | null> {
    return client.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string, client: DbClient = this.prisma): Promise<UserRecord | null> {
    return client.user.findUnique({ where: { id } });
  }

  async create(
    client: DbClient,
    data: { id: string; name: string; email: string; passwordHash: string },
  ): Promise<UserRecord> {
    try {
      return await client.user.create({
        data: {
          id: data.id,
          name: data.name,
          email: normalizeEmail(data.email),
          passwordHash: data.passwordHash,
        },
      });
    } catch (error) {
      const mapped = mapPrismaError(error, { unique: 'EMAIL_TAKEN' });
      if (mapped) throw mapped;
      throw error;
    }
  }

  async updateName(client: DbClient, id: string, name: string): Promise<UserRecord> {
    return client.user.update({ where: { id }, data: { name } });
  }

  async updatePasswordHash(client: DbClient, id: string, hash: string): Promise<void> {
    await client.user.update({ where: { id }, data: { passwordHash: hash } });
  }
}
