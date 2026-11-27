import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfigService } from '../../../config/app-config.service';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  sid: string;
}

/** Signs access JWTs and handles refresh-token generation/hashing (§9.1). */
@Injectable()
export class TokenService {
  constructor(private readonly config: AppConfigService) {}

  signAccess(userId: string, sessionId: string): string {
    return jwt.sign({ sub: userId, sid: sessionId }, this.config.get('JWT_ACCESS_SECRET'), {
      algorithm: 'HS256',
      expiresIn: `${this.config.get('ACCESS_TOKEN_TTL_MINUTES')}m`,
    });
  }

  /**
   * An expired-but-correctly-signed JWT is TOKEN_EXPIRED (the client refreshes);
   * a missing, malformed or badly signed one is UNAUTHENTICATED.
   */
  verifyAccess(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.config.get('JWT_ACCESS_SECRET'), {
        algorithms: ['HS256'],
      });
      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw new AppException('UNAUTHENTICATED');
      }
      return payload as AccessTokenPayload;
    } catch (error) {
      if (error instanceof AppException || error instanceof TokenExpiredError) {
        if (error instanceof TokenExpiredError) throw new AppException('TOKEN_EXPIRED');
        throw error;
      }
      throw new AppException('UNAUTHENTICATED');
    }
  }

  generateRefresh(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefresh(token) };
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
