import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { AppConfigService } from '../../../config/app-config.service';
import { COOKIE, CSRF_MAX_AGE_MS, REFRESH_PATH } from '../auth.constants';

/** Owns every cookie attribute and lifetime from the §9.1 cookie table. */
@Injectable()
export class CookieService {
  constructor(private readonly config: AppConfigService) {}

  /** Sets both auth cookies (outliving the JWT) and rotates CSRF. */
  setSessionCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    sessionExpiresAt: Date,
  ): string {
    const maxAge = Math.max(0, sessionExpiresAt.getTime() - Date.now());
    const base = { httpOnly: true, secure: this.config.isProduction, sameSite: 'lax' as const };
    res.cookie(COOKIE.access, accessToken, { ...base, path: '/', maxAge });
    res.cookie(COOKIE.refresh, refreshToken, { ...base, path: REFRESH_PATH, maxAge });
    return this.setCsrfCookie(res);
  }

  setCsrfCookie(res: Response, value: string = randomBytes(32).toString('base64url')): string {
    res.cookie(COOKIE.csrf, value, {
      httpOnly: false,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: CSRF_MAX_AGE_MS,
    });
    return value;
  }

  /** Bootstrap: only issue a CSRF cookie when the client does not have one. */
  csrfForRequest(req: Request, res: Response): string {
    const existing = req.cookies?.[COOKIE.csrf] as string | undefined;
    return typeof existing === 'string' && existing.length > 0 ? existing : this.setCsrfCookie(res);
  }

  csrfMatches(cookie: string | undefined, header: string | undefined): boolean {
    if (!cookie || !header || cookie.length !== header.length) return false;
    return timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
  }

  /** Logout and every refresh/session failure clear all three cookies. */
  clearAuthCookies(res: Response): void {
    const secure = this.config.isProduction;
    // Express' clearCookie only emits Expires; §9.1 also requires Max-Age=0.
    const cleared = { maxAge: 0, expires: new Date(0), secure, sameSite: 'lax' as const };
    res.cookie(COOKIE.access, '', { ...cleared, path: '/', httpOnly: true });
    res.cookie(COOKIE.refresh, '', { ...cleared, path: REFRESH_PATH, httpOnly: true });
    res.cookie(COOKIE.csrf, '', { ...cleared, path: '/', httpOnly: false });
  }
}
