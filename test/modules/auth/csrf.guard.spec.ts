import { ExecutionContext } from '@nestjs/common';
import { AppException } from '../../../src/common/errors/app.exception';
import { CsrfGuard } from '../../../src/modules/auth/guards/csrf.guard';
import { CookieService } from '../../../src/modules/auth/services/cookie.service';

const contextFor = (method: string, cookie?: string, header?: string): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        cookies: cookie ? { cr_csrf: cookie } : {},
        header: () => header,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('CsrfGuard', () => {
  const cookies = {
    csrfMatches: (cookie: string | undefined, header: string | undefined) =>
      Boolean(cookie && header && cookie === header),
  } as unknown as CookieService;
  const guard = new CsrfGuard(cookies);

  it.each(['GET', 'HEAD', 'OPTIONS'])('skips %s requests', (method) => {
    expect(guard.canActivate(contextFor(method))).toBe(true);
  });

  it('accepts a matching header and cookie on a POST', () => {
    expect(guard.canActivate(contextFor('POST', 'token', 'token'))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s without a header', (method) => {
    expect(() => guard.canActivate(contextFor(method, 'token'))).toThrow(
      expect.objectContaining({ errorCode: 'CSRF_INVALID' }),
    );
  });

  it('rejects a mismatched header even when authenticated', () => {
    expect(() => guard.canActivate(contextFor('DELETE', 'token', 'other'))).toThrow(AppException);
  });

  it('rejects a header with no cookie', () => {
    expect(() => guard.canActivate(contextFor('POST', undefined, 'token'))).toThrow(
      expect.objectContaining({ errorCode: 'CSRF_INVALID' }),
    );
  });
});
