import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { IncomingMessage } from 'node:http';
import { getCorrelationId } from '../http/correlation';
import { AppException } from './app.exception';
import { ErrorCode, ERROR_CODES } from './error-codes';
import { ErrorResponse, ResolvedError } from './error-response';
import { mapPrismaError } from './prisma-error.mapper';

const STATUS_FALLBACK_CODES: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'DOCUMENT_NOT_FOUND',
  409: 'DUPLICATE_VERSION',
  410: 'INVITATION_EXPIRED',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

interface ValidationDetail {
  field: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const resolved = this.resolve(exception);
    const context = host.switchToHttp();

    if (host.getType() !== 'http') {
      this.logger.error(`Non-HTTP error: ${resolved.message}`);
      return;
    }

    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const body: ErrorResponse = {
      success: false,
      statusCode: resolved.statusCode,
      errorCode: resolved.errorCode,
      message: resolved.message,
      ...(resolved.details === undefined ? {} : { details: resolved.details }),
      correlationId: getCorrelationId(request as IncomingMessage),
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url ?? '',
    };

    response.status(resolved.statusCode).json(body);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof AppException) {
      const payload = exception.getResponse();
      return this.fromPayload(
        exception.getStatus(),
        exception.errorCode,
        payload,
        exception.details,
      );
    }

    const prismaError = mapPrismaError(exception);
    if (prismaError) {
      return this.resolve(prismaError);
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    this.logger.error(
      `Unhandled error: ${exception instanceof Error ? exception.message : 'unknown error'}`,
    );
    return { statusCode: 500, errorCode: 'INTERNAL_ERROR', message: 'Internal server error.' };
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const errorCode =
      STATUS_FALLBACK_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    return this.fromPayload(status, errorCode, payload);
  }

  private fromPayload(
    status: number,
    errorCode: ErrorCode,
    payload: string | object,
    providedDetails?: unknown,
  ): ResolvedError {
    if (typeof payload === 'string') {
      return {
        statusCode: status,
        errorCode,
        message: payload,
        ...(providedDetails ? { details: providedDetails } : {}),
      };
    }

    const record = payload as Record<string, unknown>;
    const message =
      typeof record.message === 'string'
        ? record.message
        : errorCode.toLowerCase().replaceAll('_', ' ');
    const details = providedDetails ?? this.validationDetails(record.message);

    const isValidation = status === 400 && Array.isArray(record.message);
    return {
      // Nest's ValidationPipe throws 400; the documented catalog requires 422.
      statusCode: isValidation ? ERROR_CODES.VALIDATION_ERROR : status,
      errorCode: isValidation ? 'VALIDATION_ERROR' : errorCode,
      message,
      ...(details === undefined ? {} : { details }),
    };
  }

  private validationDetails(message: unknown): ValidationDetail[] | undefined {
    if (!Array.isArray(message)) return undefined;
    return message.map((entry: unknown) => {
      const text = typeof entry === 'string' ? entry : 'Invalid value';
      const separator = text.indexOf(' ');
      return {
        field: separator === -1 ? text : text.slice(0, separator),
        message: separator === -1 ? text : text.slice(separator + 1),
      };
    });
  }
}
