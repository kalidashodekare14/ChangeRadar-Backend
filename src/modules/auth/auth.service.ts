import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantDb } from '../../infrastructure/database/tenant-db';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SessionsRepository, SessionRecord } from './repositories/sessions.repository';
import { normalizeEmail, UserRecord, UsersRepository } from './repositories/users.repository';
import { PasswordHasher } from './services/password-hasher.service';
import { TokenService } from './services/token.service';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: PublicUser;
  session: SessionRecord;
  accessToken: string;
  refreshToken: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Used only to keep the "unknown user" path as expensive as a real verification.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$PFTD+wAYrFvlGEj20XN3PQ$iipJIuwNYuSDWrP/Qm9LTIqZ8SvduUv+yKR3FQ+izqQ';

const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantDb,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const now = new Date();
    const userId = randomUUID();
    const workspaceId = randomUUID();
    const passwordHash = await this.hasher.hash(dto.password);
    const refresh = this.tokens.generateRefresh();

    const { user, session } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await this.users.create(tx, {
        id: userId,
        name: dto.name,
        email: normalizeEmail(dto.email),
        passwordHash,
      });

      // Global user + tenant workspace/membership must succeed or fail together.
      await this.tenantDb.runInTransaction(tx, { workspaceId, userId }, async (tenantTx) => {
        const slug = this.workspaceSlug(dto.name);
        await tenantTx.workspace.create({
          data: {
            id: workspaceId,
            name: `${createdUser.name}'s workspace`,
            slug,
            status: 'ACTIVE',
            settings: { aiEnabled: true },
            createdAt: now,
          },
        });
        await tenantTx.workspaceMember.create({
          data: { id: randomUUID(), workspaceId, userId, role: 'OWNER' },
        });
      });

      const createdSession = await this.sessions.create(tx, {
        id: randomUUID(),
        userId,
        refreshTokenHash: refresh.hash,
        expiresAt: this.sessionExpiry(now),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      });
      return { user: createdUser, session: createdSession };
    });

    return {
      user: toPublicUser(user),
      session,
      accessToken: this.tokens.signAccess(user.id, session.id),
      refreshToken: refresh.token,
    };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    const valid = await this.hasher.verify(user?.passwordHash ?? DUMMY_HASH, dto.password);
    if (!user || !valid) throw new AppException('INVALID_CREDENTIALS');
    if (!user.isActive) throw new AppException('ACCOUNT_INACTIVE');
    return this.createSession(user, meta);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw new AppException('INVALID_REFRESH_TOKEN');
    const oldHash = this.tokens.hashRefresh(refreshToken);
    const session = await this.sessions.findByRefreshHash(oldHash);
    if (!session) throw new AppException('INVALID_REFRESH_TOKEN');

    const now = new Date();
    if (session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()) {
      throw new AppException('SESSION_REVOKED');
    }
    const user = await this.users.findById(session.userId);
    if (!user) throw new AppException('UNAUTHENTICATED');
    if (!user.isActive) throw new AppException('ACCOUNT_INACTIVE');

    const next = this.tokens.generateRefresh();
    const rotated = await this.sessions.rotate(this.prisma, {
      id: session.id,
      oldHash,
      newHash: next.hash,
      now,
    });
    if (!rotated) throw new AppException('INVALID_REFRESH_TOKEN');

    return {
      user: toPublicUser(user),
      session: { ...session, refreshTokenHash: next.hash, lastUsedAt: now },
      accessToken: this.tokens.signAccess(user.id, session.id),
      refreshToken: next.token,
    };
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessions.revoke(this.prisma, sessionId, userId, new Date());
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('UNAUTHENTICATED');
    return toPublicUser(user);
  }

  listSessions(userId: string): Promise<SessionRecord[]> {
    return this.sessions.listActive(this.prisma, userId, new Date());
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    if (!(await this.sessions.revoke(this.prisma, sessionId, userId, new Date()))) {
      throw new AppException('FORBIDDEN', 'Session not found');
    }
  }

  revokeOthers(userId: string, currentSessionId: string): Promise<number> {
    return this.sessions.revokeOthers(this.prisma, userId, currentSessionId, new Date());
  }

  private async createSession(user: UserRecord, meta: RequestMeta): Promise<AuthResult> {
    const refresh = this.tokens.generateRefresh();
    const session = await this.sessions.create(this.prisma, {
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: this.sessionExpiry(new Date()),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
    return {
      user: toPublicUser(user),
      session,
      accessToken: this.tokens.signAccess(user.id, session.id),
      refreshToken: refresh.token,
    };
  }

  private sessionExpiry(now: Date): Date {
    return new Date(now.getTime() + this.config.get('SESSION_TTL_DAYS') * DAY_MS);
  }

  private workspaceSlug(name: string): string {
    const base = name
      .normalize('NFKD')
      .replaceAll(/[^a-zA-Z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 160);
    return `${base || 'workspace'}-${randomBytes(4).toString('hex')}`;
  }
}
