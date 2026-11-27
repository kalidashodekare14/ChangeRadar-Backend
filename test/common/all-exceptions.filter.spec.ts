import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from '../../src/common/errors/all-exceptions.filter';
import { AppException } from '../../src/common/errors/app.exception';

function createHost(): {
  host: ArgumentsHost;
  response: { status: jest.Mock; json: jest.Mock<void, [unknown]> };
} {
  const request = {
    headers: { 'x-request-id': 'correlation-123' },
    originalUrl: '/api/v1/documents',
  };
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn<void, [unknown]>(),
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('uses the documented error envelope for domain exceptions', () => {
    const { host, response } = createHost();
    filter.catch(new AppException('DOCUMENT_NOT_FOUND', 'Document not found'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        errorCode: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
        correlationId: 'correlation-123',
        path: '/api/v1/documents',
      }),
    );
  });

  it('maps validation errors to VALIDATION_ERROR with field details', () => {
    const { host, response } = createHost();
    filter.catch(new BadRequestException(['title should not be empty']), host);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        errorCode: 'VALIDATION_ERROR',
        details: [{ field: 'title', message: 'should not be empty' }],
      }),
    );
  });

  it('maps Prisma unique violations to a 409 without leaking internals', () => {
    const { host, response } = createHost();
    const error = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'DUPLICATE_VERSION' }),
    );
  });

  it('hides stack traces for unexpected errors', () => {
    const { host, response } = createHost();
    filter.catch(new Error('secret database connection string'), host);

    const body = (response.json.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(response.status).toHaveBeenCalledWith(500);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(body.message).toBe('Internal server error.');
  });
});
