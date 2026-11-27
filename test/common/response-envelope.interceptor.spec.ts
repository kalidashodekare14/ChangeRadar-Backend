import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { paginate } from '../../src/common/pagination/paginated-response';

function contextWithRequest(request: object): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function handlerWith(data: unknown): CallHandler {
  return { handle: () => of(data) } as CallHandler;
}

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();

  it('wraps plain data and adds a correlation ID', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        contextWithRequest({ headers: { 'x-request-id': 'req-1' } }),
        handlerWith({ id: 'doc-1' }),
      ),
    );
    expect(result).toEqual({
      success: true,
      data: { id: 'doc-1' },
      correlationId: 'req-1',
    });
  });

  it('adds meta only for paginated data', async () => {
    const meta = { page: 1, pageSize: 20, total: 57 };
    const result = await firstValueFrom(
      interceptor.intercept(
        contextWithRequest({ headers: {} }),
        handlerWith(paginate([{ id: 'doc-1' }], meta)),
      ),
    );
    expect(result).toMatchObject({ success: true, data: [{ id: 'doc-1' }], meta });
  });

  it('does not double-wrap an existing envelope', async () => {
    const envelope = { success: true, data: null };
    const result = await firstValueFrom(
      interceptor.intercept(contextWithRequest({ headers: {} }), handlerWith(envelope)),
    );
    expect(result).toBe(envelope);
  });
});
