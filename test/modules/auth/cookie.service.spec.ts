import type { Response } from 'express';
import { AppConfigService } from '../../../src/config/app-config.service';
import { CookieService } from '../../../src/modules/auth/services/cookie.service';

function setup(isProduction: boolean) {
  const config = { get: () => undefined, isProduction } as unknown as AppConfigService;
  const res = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return { service: new CookieService(config), res };
}

describe('CookieService', () => {
  it('sets auth cookies with the §9.1 attributes and remaining session lifetime', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const { service, res } = setup(false);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const csrf = service.setSessionCookies(res, 'access-jwt', 'refresh-token', expiresAt);

    expect(res.cookie).toHaveBeenCalledWith(
      'cr_access',
      'access-jwt',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'cr_refresh',
      'refresh-token',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth', sameSite: 'lax' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'cr_csrf',
      csrf,
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
    jest.useRealTimers();
  });

  it('uses Secure cookies in production', () => {
    const { service, res } = setup(true);
    service.setCsrfCookie(res, 'csrf');
    expect(res.cookie).toHaveBeenCalledWith(
      'cr_csrf',
      'csrf',
      expect.objectContaining({ secure: true }),
    );
  });

  it('clears every cookie with Max-Age=0 and the correct path on logout', () => {
    const { service, res } = setup(false);
    service.clearAuthCookies(res);
    expect(res.cookie).toHaveBeenCalledTimes(3);
    expect(res.cookie).toHaveBeenCalledWith(
      'cr_refresh',
      '',
      expect.objectContaining({ path: '/api/v1/auth', maxAge: 0 }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'cr_access',
      '',
      expect.objectContaining({ path: '/', maxAge: 0 }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'cr_csrf',
      '',
      expect.objectContaining({ path: '/', maxAge: 0 }),
    );
  });

  it('compares CSRF values in constant time and rejects missing/mismatched ones', () => {
    const { service } = setup(false);
    expect(service.csrfMatches('abc123', 'abc123')).toBe(true);
    expect(service.csrfMatches('abc123', 'abc124')).toBe(false);
    expect(service.csrfMatches(undefined, 'abc123')).toBe(false);
    expect(service.csrfMatches('abc123', undefined)).toBe(false);
    expect(service.csrfMatches('abc', 'abcdef')).toBe(false);
  });

  it('bootstraps CSRF only when the request has no cookie', () => {
    const { service, res } = setup(false);
    const setSpy = jest.spyOn(service, 'setCsrfCookie').mockReturnValue('new-token');
    expect(service.csrfForRequest({ cookies: {} } as never, res)).toBe('new-token');
    expect(service.csrfForRequest({ cookies: { cr_csrf: 'existing' } } as never, res)).toBe(
      'existing',
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
  });
});
