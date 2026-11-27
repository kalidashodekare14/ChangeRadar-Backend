import jwt from 'jsonwebtoken';
import { AppException } from '../../../src/common/errors/app.exception';
import { AppConfigService } from '../../../src/config/app-config.service';
import { TokenService } from '../../../src/modules/auth/services/token.service';

const SECRET = 'unit-test-access-secret';
const config = {
  get: (key: string) => ({ JWT_ACCESS_SECRET: SECRET, ACCESS_TOKEN_TTL_MINUTES: 15 })[key],
  isProduction: false,
} as unknown as AppConfigService;

describe('TokenService', () => {
  const service = new TokenService(config);

  it('signs a JWT with sub, sid and a 15-minute expiry', () => {
    const token = service.signAccess('user-1', 'session-1');
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe('user-1');
    expect((payload as { sid: string }).sid).toBe('session-1');
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
  });

  it('verifies a valid token and returns its claims', () => {
    const payload = service.verifyAccess(service.signAccess('u', 's'));
    expect(payload).toMatchObject({ sub: 'u', sid: 's' });
  });

  it('maps an expired but signed token to TOKEN_EXPIRED', () => {
    const expired = jwt.sign({ sub: 'u', sid: 's' }, SECRET, { expiresIn: '-1s' });
    expect(() => service.verifyAccess(expired)).toThrow(
      expect.objectContaining({ errorCode: 'TOKEN_EXPIRED' }),
    );
  });

  it('maps a bad signature and a malformed token to UNAUTHENTICATED', () => {
    const foreign = jwt.sign({ sub: 'u', sid: 's' }, 'another-secret');
    for (const token of [foreign, 'garbled']) {
      expect(() => service.verifyAccess(token)).toThrow(
        expect.objectContaining({ errorCode: 'UNAUTHENTICATED' }),
      );
    }
  });

  it('maps a token without sid to UNAUTHENTICATED', () => {
    const noSid = jwt.sign({ sub: 'u' }, SECRET);
    expect(() => service.verifyAccess(noSid)).toThrow(AppException);
    expect(() => service.verifyAccess(noSid)).toThrow(
      expect.objectContaining({ errorCode: 'UNAUTHENTICATED' }),
    );
  });

  it('generates 32-byte refresh tokens and stable SHA-256 hashes', () => {
    const first = service.generateRefresh();
    const second = service.generateRefresh();
    expect(first.token).not.toBe(second.token);
    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
    expect(first.hash).toBe(service.hashRefresh(first.token));
    expect(first.hash).toHaveLength(64);
  });
});
