import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PasswordHasher } from '../auth/services/password-hasher.service';
import { SessionsRepository } from '../auth/repositories/sessions.repository';
import { UsersRepository } from '../auth/repositories/users.repository';
import { PublicUser } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async updateName(userId: string, name: string): Promise<PublicUser> {
    const user = await this.users.updateName(this.prisma, userId, name);
    return { id: user.id, name: user.name, email: user.email };
  }

  /** Requires the current password; the current session stays authenticated. */
  async changePassword(
    userId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: true }> {
    const user = await this.users.findById(userId);
    if (!user?.passwordHash || !(await this.hasher.verify(user.passwordHash, currentPassword))) {
      throw new AppException('INVALID_CREDENTIALS');
    }
    const hash = await this.hasher.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await this.users.updatePasswordHash(tx, userId, hash);
      await this.sessions.revokeOthers(tx, userId, currentSessionId, new Date());
    });
    return { changed: true };
  }
}
