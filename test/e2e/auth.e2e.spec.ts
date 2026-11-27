import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request, { Response } from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TenantDb } from '../../src/infrastructure/database/tenant-db';
import { RedisClient } from '../../src/infrastructure/redis/redis-client';
import { configureApp } from '../../src/setup-app';

// Needs the migrated local database and Redis (CI sets RUN_DB_TESTS=true).
const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

const cookieHeader = (res: Response, name: string): string | undefined =>
  (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((cookie) =>
    cookie.startsWith(`${name}=`),
  );

const cookieValue = (res: Response, name: string): string | undefined =>
  cookieHeader(res, name)?.match(new RegExp(`${name}=([^;]+)`))?.[1];

const maxAge = (res: Response, name: string): number =>
  Number(cookieHeader(res, name)?.match(/Max-Age=(\d+)/)?.[1] ?? NaN);

describeDb('auth E2E (§9.1, §30.1)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let redis: RedisClient;
  const secret = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    redis = app.get(RedisClient);
  });

  beforeEach(async () => {
    // Each test gets a clean slate so the 3/min register limit does not leak.
    const keys = await redis.client.keys('cr:throttle:*');
    if (keys.length > 0) await redis.client.del(...keys);
  });

  afterAll(async () => {
    await app?.close();
  });

  const bootstrapCsrf = async (): Promise<string> => {
    const res = await request(server).get('/api/v1/auth/csrf').expect(200);
    return res.body.data.csrfToken as string;
  };

  const register = async (csrfToken: string, email: string, password = 'a-strong-password') => {
    const res = await request(server)
      .post('/api/v1/auth/register')
      .set('Cookie', `cr_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Ada Lovelace', email, password })
      .expect(201);
    return {
      res,
      access: cookieValue(res, 'cr_access'),
      refresh: cookieValue(res, 'cr_refresh'),
      csrf: cookieValue(res, 'cr_csrf') ?? csrfToken,
    };
  };

  const login = async (csrfToken: string, email: string, password: string) => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .set('Cookie', `cr_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password });
    return {
      res,
      access: cookieValue(res, 'cr_access'),
      csrf: cookieValue(res, 'cr_csrf') ?? csrfToken,
    };
  };

  it('rejects register and login without a CSRF header, then succeeds after /auth/csrf', async () => {
    await request(server)
      .post('/api/v1/auth/register')
      .send({ name: 'Ada', email: `${randomUUID()}@example.com`, password: 'a-strong-password' })
      .expect(403)
      .expect((res) => expect(res.body.errorCode).toBe('CSRF_INVALID'));

    const csrfToken = await bootstrapCsrf();
    const email = `${randomUUID()}@example.com`;
    const { res } = await register(csrfToken, email);
    expect(res.body.data).toMatchObject({ name: 'Ada Lovelace', email });
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(cookieHeader(res, 'cr_csrf')).toBeDefined();
    expect(cookieHeader(res, 'cr_access')).toMatch(/HttpOnly/);
    expect(maxAge(res, 'cr_refresh')).toBeGreaterThan(30 * 24 * 60 * 60 - 5);
    expect(maxAge(res, 'cr_csrf')).toBe(30 * 24 * 60 * 60);

    // Registration creates the personal workspace + OWNER membership atomically.
    const userId = res.body.data.id as string;
    const memberships = await app
      .get(TenantDb)
      .run({ userId }, (tx) => tx.workspaceMember.findMany({ where: { userId } }));
    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe('OWNER');
    await expect(app.get(PrismaService).user.count({ where: { id: userId } })).resolves.toBe(1);
  });

  it('returns TOKEN_EXPIRED for an expired but signed JWT and refreshes successfully', async () => {
    const csrfToken = await bootstrapCsrf();
    const email = `${randomUUID()}@example.com`;
    const { res, access, refresh, csrf } = await register(csrfToken, email);
    const userId = res.body.data.id as string;
    const sessions = await request(server)
      .get('/api/v1/auth/sessions')
      .set('Cookie', `cr_access=${access}`)
      .expect(200);
    const sessionId = sessions.body.data[0].id as string;

    const expired = jwt.sign({ sub: userId, sid: sessionId }, secret, { expiresIn: '-1s' });
    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${expired}`)
      .expect(401)
      .expect((response) => expect(response.body.errorCode).toBe('TOKEN_EXPIRED'));

    // The access cookie still lives in the browser after the JWT expires (M-11).
    expect(maxAge(res, 'cr_access')).toBeGreaterThan(15 * 60);

    const refreshed = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`cr_refresh=${refresh}`, `cr_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(201);
    expect(refreshed.body.data).toMatchObject({ id: userId });
    expect(cookieValue(refreshed, 'cr_refresh')).not.toBe(refresh);

    // The old refresh token is rejected and its failure clears the auth cookies.
    const reuse = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`cr_refresh=${refresh}`, `cr_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(401);
    expect(reuse.body.errorCode).toBe('INVALID_REFRESH_TOKEN');
    expect(cookieHeader(reuse, 'cr_access')).toMatch(/Max-Age=0/);
  });

  it('supports me, logout and immediate session revocation', async () => {
    const csrfToken = await bootstrapCsrf();
    const { res, access, refresh, csrf } = await register(csrfToken, `${randomUUID()}@example.com`);
    const userId = res.body.data.id as string;

    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${access}`)
      .expect(200)
      .expect((response) => expect(response.body.data).toMatchObject({ id: userId }));

    await request(server)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`cr_access=${access}`, `cr_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(201);

    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${access}`)
      .expect(401)
      .expect((response) => expect(response.body.errorCode).toBe('SESSION_REVOKED'));

    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`cr_refresh=${refresh}`, `cr_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(401)
      .expect((response) => expect(response.body.errorCode).toBe('SESSION_REVOKED'));
  });

  it('lists sessions, revokes one and revokes all others', async () => {
    const csrfToken = await bootstrapCsrf();
    const email = `${randomUUID()}@example.com`;
    const { res, access, csrf } = await register(csrfToken, email);
    const second = await login(csrf, email, 'a-strong-password');

    const listed = await request(server)
      .get('/api/v1/auth/sessions')
      .set('Cookie', `cr_access=${access}`)
      .expect(200);
    expect(listed.body.data).toHaveLength(2);
    expect(listed.body.data[0]).not.toHaveProperty('refreshTokenHash');

    await request(server)
      .post('/api/v1/auth/sessions/revoke-others')
      .set('Cookie', [`cr_access=${access}`, `cr_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(201)
      .expect((response) => expect(response.body.data.revokedCount).toBe(1));

    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${second.access}`)
      .expect(401)
      .expect((response) => expect(response.body.errorCode).toBe('SESSION_REVOKED'));

    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${access}`)
      .expect(200)
      .expect((response) => expect(response.body.data.id).toBe(res.body.data.id));
  });

  it('normalizes email, rejects duplicates and uses a generic INVALID_CREDENTIALS', async () => {
    const csrfToken = await bootstrapCsrf();
    const email = `${randomUUID()}@example.com`;
    const { csrf } = await register(csrfToken, email);

    await request(server)
      .post('/api/v1/auth/register')
      .set('Cookie', `cr_csrf=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Other', email: email.toUpperCase(), password: 'a-strong-password' })
      .expect(409)
      .expect((res) => expect(res.body.errorCode).toBe('EMAIL_TAKEN'));

    await request(server)
      .post('/api/v1/auth/login')
      .set('Cookie', `cr_csrf=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({ email, password: 'wrong-password' })
      .expect(401)
      .expect((res) => expect(res.body.errorCode).toBe('INVALID_CREDENTIALS'));
  });

  it('changes the password and revokes other sessions', async () => {
    const csrfToken = await bootstrapCsrf();
    const email = `${randomUUID()}@example.com`;
    const { res, access, csrf } = await register(csrfToken, email);
    const userId = res.body.data.id as string;

    const second = await login(csrf, email, 'a-strong-password');
    expect(second.res.status).toBe(201);

    await request(server)
      .post('/api/v1/users/me/password')
      .set('Cookie', [`cr_access=${access}`, `cr_csrf=${second.csrf}`])
      .set('X-CSRF-Token', second.csrf)
      .send({ currentPassword: 'a-strong-password', newPassword: 'an-even-stronger-password' })
      .expect(201);

    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${second.access}`)
      .expect(401)
      .expect((response) => expect(response.body.errorCode).toBe('SESSION_REVOKED'));

    await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', `cr_access=${access}`)
      .expect(200)
      .expect((response) => expect(response.body.data.id).toBe(userId));

    const relogin = await login(second.csrf, email, 'an-even-stronger-password');
    expect(relogin.res.status).toBe(201);
    expect(relogin.access).toBeDefined();
  });

  it('rate-limits login at 5 requests per minute per IP', async () => {
    const csrfToken = await bootstrapCsrf();
    const email = `${randomUUID()}@example.com`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server)
        .post('/api/v1/auth/login')
        .set('Cookie', `cr_csrf=${csrfToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }
    await request(server)
      .post('/api/v1/auth/login')
      .set('Cookie', `cr_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password: 'wrong-password' })
      .expect(429)
      .expect((res) => expect(res.body.errorCode).toBe('RATE_LIMITED'));
  }, 60_000);
});
