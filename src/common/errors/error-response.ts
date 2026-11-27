import { ErrorCode } from './error-codes';

/** Exact error envelope from ARCHITECTURE §10.2. */
export interface ErrorResponse {
  success: false;
  statusCode: number;
  errorCode: ErrorCode;
  message: string;
  details?: unknown;
  correlationId: string;
  timestamp: string;
  path: string;
}

export interface ResolvedError {
  statusCode: number;
  errorCode: ErrorCode;
  message: string;
  details?: unknown;
}
