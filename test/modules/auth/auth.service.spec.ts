import { randomUUID } from 'node:crypto';
import { AppException } from '../../../src/common/errors/app.exception';
import { AppConfigService } from '../../../src/config/app-config.service';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { TenantDb } from '../../../src/infrastructure/database/tenant-db';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { SessionsRepository } from '../../../src/modules/auth/repositories/sessions.repository';
import { UsersRepository } from '../../../src/modules/auth/repositories/users.repository';
import { PasswordHasher } from '../../../src/modules/auth/services/password-hasher.service';
import { TokenService } from '../../../src/modules/auth/services/token.service';

const USER = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'hashed',
  isActive: true,
};
const SESSION = {
  id: 'session-1',
  userId: 'user-1',
  refreshTokenHash: 'hash-old',
  expiresAt: new Date(Date.now() + 2_592_000_000),
  revokedAt: null,
  lastUsedAt: null,
  userAgent: null,
  createdAt: new Date(),
};

function setup() {
  const tenantTx = {
    workspace: { create: jest.fn() },
    workspaceMember: { create: jest.fn() },
  };
  const tx = {} as object;
  const prisma = {
    $transaction: jest.fn(async (fn: (client: object) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;
  const tenantDb = {
    runInTransaction: jest.fn(
      async (_tx: object, _ctx: object, fn: (t: object) => Promise<unknown>) => fn(tenantTx),
    ),
  } as unknown as TenantDb;
  const users = {
    create: jest.fn().mockResolvedValue(USER),
    findByEmail: jest.fn().mockResolvedValue(USER),
    findById: jest.fn().mockResolvedValue(USER),
    updateName: jest.fn(),
    updatePasswordHash: jest.fn(),
  } as unknown as UsersRepository;
  const sessions = {
    create: jest.fn().mockResolvedValue(SESSION),
    findByRefreshHash: jest.fn().mockResolvedValue(SESSION),
    rotate: jest.fn().mockResolvedValue(true),
    revoke: jest.fn().mockResolvedValue(true),
    revokeOthers: jest.fn().mockResolvedValue(1),
    findById: jest.fn(),
    listActive: jest.fn(),
  } as unknown as SessionsRepository;
  const hasher = {
    hash: jest.fn().mockResolvedValue('hashed'),
    verify: jest.fn().mockResolvedValue(true),
  } as unknown as PasswordHasher;
  const tokens = {
    signAccess: jest.fn().mockReturnValue('jwt'),
    generateRefresh: jest.fn().mockReturnValue({ token: 'refresh-new', hash: 'hash-new' }),
    hashRefresh: jest.fn().mockImplementation((token: string) => `hash-${token}`),
  } as unknown as TokenService;
  const config = {
    get: (key: string) => (key === 'SESSION_TTL_DAYS' ? 30 : undefined),
  } as unknown as AppConfigService;
  return {
    service: new AuthService(config, prisma, tenantDb, users, sessions, hasher, tokens),
    prisma,
    tenantDb,
    tenantTx,
    users,
    sessions,
    hasher,
    tokens,
  };
}

describe('AuthService', () => {
  const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' };
  const registerDto = {
    name: 'Ada',
    email: 'ADA@Example.com',
    password: 'a-long-password',
  };

  it('registers atomically with a personal workspace and OWNER membership', async () => {
    const mocks = setup();
    const result = await mocks.service.register(registerDto, meta);

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.users.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'ada@example.com', passwordHash: 'hashed' }),
    );
    expect(mocks.tenantDb.runInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: expect.any(String), workspaceId: expect.any(String) }),
      expect.any(Function),
    );
    expect(mocks.tenantTx.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ settings: { aiEnabled: true }, status: 'ACTIVE' }),
      }),
    );
    expect(mocks.tenantTx.workspaceMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'OWNER', userId: expect.any(String) }),
      }),
    );
    expect(result).toMatchObject({
      user: { id: USER.id, email: USER.email },
      accessToken: 'jwt',
      refreshToken: 'refresh-new',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('propagates EMAIL_TAKEN from registration', async () => {
    const mocks = setup();
    jest.spyOn(mocks.users, 'create').mockRejectedValue(new AppException('EMAIL_TAKEN'));
    await expect(mocks.service.register(registerDto, meta)).rejects.toMatchObject({
      errorCode: 'EMAIL_TAKEN',
    });
  });

  it('uses a generic INVALID_CREDENTIALS for unknown users and wrong passwords', async () => {
    const mocks = setup();
    jest.spyOn(mocks.users, 'findByEmail').mockResolvedValue(null);
    await expect(
      mocks.service.login({ email: USER.email, password: 'wrong-password' }, meta),
    ).rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
    expect(mocks.hasher.verify).toHaveBeenCalled();

    jest.spyOn(mocks.users, 'findByEmail').mockResolvedValue(USER);
    jest.spyOn(mocks.hasher, 'verify').mockResolvedValue(false);
    await expect(
      mocks.service.login({ email: USER.email, password: 'wrong-password' }, meta),
    ).rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
  });

  it('rejects inactive users on login', async () => {
    const mocks = setup();
    jest.spyOn(mocks.users, 'findByEmail').mockResolvedValue({ ...USER, isActive: false });
    await expect(
      mocks.service.login({ email: USER.email, password: 'a-long-password' }, meta),
    ).rejects.toMatchObject({ errorCode: 'ACCOUNT_INACTIVE' });
  });

  it('rotates the refresh token and returns new tokens', async () => {
    const mocks = setup();
    const result = await mocks.service.refresh('refresh-old');
    expect(mocks.sessions.rotate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ oldHash: 'hash-refresh-old', newHash: 'hash-new' }),
    );
    expect(result).toMatchObject({ accessToken: 'jwt', refreshToken: 'refresh-new' });
  });

  it.each(['INVALID_REFRESH_TOKEN', 'SESSION_REVOKED'])('rejects %s on refresh', async (code) => {
    const mocks = setup();
    if (code === 'INVALID_REFRESH_TOKEN') {
      jest.spyOn(mocks.sessions, 'rotate').mockResolvedValue(false);
    } else {
      jest.spyOn(mocks.sessions, 'findByRefreshHash').mockResolvedValue({
        ...SESSION,
        revokedAt: new Date(),
      });
    }
    await expect(mocks.service.refresh('refresh-old')).rejects.toMatchObject({ errorCode: code });
  });

  it('rejects a refresh with no cookie', async () => {
    const mocks = setup();
    await expect(mocks.service.refresh(undefined)).rejects.toMatchObject({
      errorCode: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('revokes only the requested session on logout', async () => {
    const mocks = setup();
    await mocks.service.logout(USER.id, SESSION.id);
    expect(mocks.sessions.revoke).toHaveBeenCalledWith(
      expect.anything(),
      SESSION.id,
      USER.id,
      expect.any(Date),
    );
  });

  it('revokes other sessions, keeping the current one', async () => {
    const mocks = setup();
    await expect(mocks.service.revokeOthers(USER.id, SESSION.id)).resolves.toBe(1);
    expect(mocks.sessions.revokeOthers).toHaveBeenCalledWith(
      expect.anything(),
      USER.id,
      SESSION.id,
      expect.any(Date),
    );
    expect(randomUUID).toBeDefined();
  });
});
