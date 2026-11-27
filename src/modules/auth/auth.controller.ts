import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserData } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CsrfResponseDto } from './dto/csrf-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import type { AuthResult, PublicUser, RequestMeta } from './auth.service';
import { CookieService } from './services/cookie.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
  ) {}

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Bootstrap the CSRF cookie before a state-changing request' })
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response): CsrfResponseDto {
    return { csrfToken: this.cookies.csrfForRequest(req, res) };
  }

  @Public()
  @Post('register')
  @Throttle({ global: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register, create a personal workspace and start a session' })
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    return this.issue(res, this.auth.register(dto, this.meta(req)));
  }

  @Public()
  @Post('login')
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    return this.issue(res, this.auth.login(dto, this.meta(req)));
  }

  @Public()
  @Post('refresh')
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<PublicUser> {
    const refreshToken = req.cookies?.['cr_refresh'] as string | undefined;
    return this.issue(res, this.auth.refresh(refreshToken));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session and clear all auth cookies' })
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revoked: true }> {
    await this.auth.logout(user.id, user.sessionId);
    this.cookies.clearAuthCookies(res);
    return { revoked: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  me(@CurrentUser() user: CurrentUserData): Promise<PublicUser> {
    return this.auth.me(user.id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List the current user’s active sessions' })
  async sessions(@CurrentUser() user: CurrentUserData): Promise<object[]> {
    const sessions = await this.auth.listSessions(user.id);
    // Never expose the refresh-token hash.
    return sessions.map(({ id, userAgent, expiresAt, lastUsedAt, createdAt }) => ({
      id,
      userAgent,
      expiresAt,
      lastUsedAt,
      createdAt,
    }));
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke one of the current user’s sessions' })
  async revokeSession(
    @CurrentUser() user: CurrentUserData,
    @Param('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revoked: true }> {
    await this.auth.revokeSession(user.id, sessionId);
    if (sessionId === user.sessionId) this.cookies.clearAuthCookies(res);
    return { revoked: true };
  }

  @Post('sessions/revoke-others')
  @ApiOperation({ summary: 'Revoke every other active session' })
  async revokeOthers(@CurrentUser() user: CurrentUserData): Promise<{ revokedCount: number }> {
    return { revokedCount: await this.auth.revokeOthers(user.id, user.sessionId) };
  }

  private async issue(res: Response, pending: Promise<AuthResult>): Promise<PublicUser> {
    try {
      const result = await pending;
      this.cookies.setSessionCookies(
        res,
        result.accessToken,
        result.refreshToken,
        result.session.expiresAt,
      );
      return result.user;
    } catch (error) {
      if (
        error instanceof AppException &&
        (error.errorCode === 'INVALID_REFRESH_TOKEN' || error.errorCode === 'SESSION_REVOKED')
      ) {
        this.cookies.clearAuthCookies(res);
      }
      throw error;
    }
  }

  private meta(req: Request): RequestMeta {
    return { userAgent: req.header('user-agent') ?? undefined, ipAddress: req.ip ?? undefined };
  }
}
