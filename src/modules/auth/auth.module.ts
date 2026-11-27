import { Module } from '@nestjs/common';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsRepository } from './repositories/sessions.repository';
import { UsersRepository } from './repositories/users.repository';
import { CookieService } from './services/cookie.service';
import { PasswordHasher } from './services/password-hasher.service';
import { TokenService } from './services/token.service';

/** Identity, sessions and the reusable token/cookie/CSRF providers. */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCleanupService,
    PasswordHasher,
    TokenService,
    CookieService,
    UsersRepository,
    SessionsRepository,
  ],
  exports: [
    AuthService,
    AuthCleanupService,
    PasswordHasher,
    TokenService,
    CookieService,
    UsersRepository,
    SessionsRepository,
  ],
})
export class AuthModule {}
