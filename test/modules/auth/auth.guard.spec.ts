import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../../src/common/errors/app.exception';
import { AuthGuard } from '../../../src/modules/auth/guards/auth.guard';
import { SessionsRepository } from '../../../src/modules/auth/repositories/sessions.repository';
import { UsersRepository } from '../../../src/modules/auth/repositories/users.repository';
import { CookieService } from '../../../src/modules/auth/services/cookie.service';
import { TokenService } from '../../../src/modules/auth/services/token.service';

const SESSION = {
  id: 'session-1',
  userId: 'user-1',
  refreshTokenHash: 'hash',
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  lastUsedAt: null,
  userAgent: null,
  createdAt: new Date(),
};
const USER = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'h',
  isActive: true,
};

function setup(overrides: {
  isPublic?: boolean;
  token?: () => unknown;
  session?: () => unknown;
  user?: () => unknown;
}) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(overrides.isPublic ?? false),
  } as unknown as Reflector;
  const tokens = {
    verifyAccess: jest.fn().mockImplementation(() => {
      if (overrides.token) return overrides.token();
      return { sub: 'user-1', sid: 'session-1' };
    }),
  } as unknown as TokenService;
  const sessions = {
    findById: jest.fn().mockImplementation(() => {
      if (overrides.session) return overrides.session();
      return SESSION;
    }),
  } as unknown as SessionsRepository;
  const users = {
    findById: jest.fn().mockImplementation(() => {
      if (overrides.user) return overrides.user();
      return USER;
    }),
  } as unknown as UsersRepository;
  const cookies = { clearAuthCookies: jest.fn() } as unknown as CookieService;
  return {
    guard: new AuthGuard(reflector, tokens, users, sessions, cookies),
    cookies,
  };
}

function context(cookie?: string): { ctx: ExecutionContext; req: { user?: unknown } } {
  const req: { cookies: Record<string, string>; user?: unknown } = {
    cookies: cookie ? { cr_access: cookie } : {},
  };
  return {
    req,
    ctx: {
      getType: () => 'http',
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    } as unknown as ExecutionContext,
  };
}

describe('AuthGuard', () => {
  it('bypasses @Public() routes', async () => {
    const { guard } = setup({ isPublic: true });
    await expect(guard.canActivate(context().ctx)).resolves.toBe(true);
  });

  it.each(['UNAUTHENTICATED', 'TOKEN_EXPIRED'])(
    'propagates %s from token verification',
    async (code) => {
      const { guard } = setup({
        token: () => {
          throw new AppException(code as 'UNAUTHENTICATED' | 'TOKEN_EXPIRED');
        },
      });
      await expect(guard.canActivate(context('jwt').ctx)).rejects.toMatchObject({
        errorCode: code,
      });
    },
  );

  it('rejects a missing cookie', async () => {
    const { guard } = setup({});
    await expect(guard.canActivate(context().ctx)).rejects.toMatchObject({
      errorCode: 'UNAUTHENTICATED',
    });
  });

  it.each([null, { ...SESSION, revokedAt: new Date() }, { ...SESSION, expiresAt: new Date(0) }])(
    'rejects a revoked or expired session and clears cookies',
    async (session) => {
      const { guard, cookies } = setup({ session: () => session });
      await expect(guard.canActivate(context('jwt').ctx)).rejects.toMatchObject({
        errorCode: 'SESSION_REVOKED',
      });
      expect(cookies.clearAuthCookies).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an inactive user', async () => {
    const { guard } = setup({ user: () => ({ ...USER, isActive: false }) });
    await expect(guard.canActivate(context('jwt').ctx)).rejects.toMatchObject({
      errorCode: 'ACCOUNT_INACTIVE',
    });
  });

  it('rejects a user that no longer exists', async () => {
    const { guard } = setup({ user: () => null });
    await expect(guard.canActivate(context('jwt').ctx)).rejects.toMatchObject({
      errorCode: 'UNAUTHENTICATED',
    });
  });

  it('attaches the current user on a valid request', async () => {
    const { guard } = setup({});
    const { ctx, req } = context('jwt');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'user-1', sessionId: 'session-1', email: USER.email });
  });
});
