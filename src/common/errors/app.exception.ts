import { HttpException } from '@nestjs/common';
import { ErrorCode, ERROR_CODES } from './error-codes';

/** Domain exception carrying a documented error code. */
export class AppException extends HttpException {
  constructor(
    override readonly errorCode: ErrorCode,
    message?: string,
    readonly details?: unknown,
    statusCode?: number,
  ) {
    super(
      {
        errorCode,
        message: message ?? errorCode.toLowerCase().replaceAll('_', ' '),
        details,
      },
      statusCode ?? ERROR_CODES[errorCode],
    );
  }
}
