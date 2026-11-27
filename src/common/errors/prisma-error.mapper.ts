import { Prisma } from '../../generated/prisma/client';
import { AppException } from './app.exception';
import { ErrorCode } from './error-codes';

/** Domain-specific overrides for the generic fallback codes. */
export interface PrismaErrorOverrides {
  unique?: ErrorCode;
  notFound?: ErrorCode;
}

/**
 * Fallback mapping for unexpected Prisma errors (§10.3). Domain services throw
 * specific AppException codes for expected conflicts; this keeps the mapping
 * tied to the generated client instead of stringly-typed error names.
 */
export function mapPrismaError(
  error: unknown,
  overrides: PrismaErrorOverrides = {},
): AppException | undefined {
  const isPrismaError =
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: unknown }).name === Prisma.PrismaClientKnownRequestError.name);
  if (!isPrismaError) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') {
    return undefined;
  }

  switch (code) {
    case 'P2002':
      return new AppException(overrides.unique ?? 'DUPLICATE_VERSION');
    case 'P2003':
    case 'P2025':
      return new AppException(overrides.notFound ?? 'DOCUMENT_NOT_FOUND');
    default:
      return undefined;
  }
}
