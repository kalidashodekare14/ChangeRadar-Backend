import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception';
import { COOKIE } from '../auth.constants';
import { CookieService } from '../services/cookie.service';

/**
 * Double-submit CSRF. No exemptions: every non-GET/HEAD/OPTIONS request —
 * including login, register and refresh — needs the header (§9.1).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly cookies: CookieService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;

    const cookie = request.cookies?.[COOKIE.csrf] as string | undefined;
    const header = request.header('x-csrf-token') ?? undefined;
    if (!this.cookies.csrfMatches(cookie, header)) {
      throw new AppException('CSRF_INVALID');
    }
    return true;
  }
}
