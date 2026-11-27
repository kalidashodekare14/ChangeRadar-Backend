import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { AppException } from '../../../common/errors/app.exception';
import { CurrentUserData } from '../decorators/current-user.decorator';
import { COOKIE, IS_PUBLIC_KEY } from '../auth.constants';
import { CookieService } from '../services/cookie.service';
import { SessionsRepository } from '../repositories/sessions.repository';
import { TokenService } from '../services/token.service';
import { UsersRepository } from '../repositories/users.repository';

/** Global guard: valid JWT + live session + active user, unless @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly cookies: CookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: CurrentUserData }>();
    const response = http.getResponse<Response>();
    const token = request.cookies?.[COOKIE.access] as string | undefined;
    if (!token) throw new AppException('UNAUTHENTICATED');

    const payload = this.tokens.verifyAccess(token);
    const session = await this.sessions.findById(payload.sid);
    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      this.cookies.clearAuthCookies(response);
      throw new AppException('SESSION_REVOKED');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new AppException('UNAUTHENTICATED');
    if (!user.isActive) throw new AppException('ACCOUNT_INACTIVE');

    request.user = {
      id: user.id,
      sessionId: session.id,
      email: user.email,
      name: user.name,
    };
    return true;
  }
}
