import { AppException } from './app.exception';

/**
 * Fallback mapping for unexpected Prisma errors (§10.3). Domain services throw
 * specific AppException codes for expected conflicts; later phases refine this
 * mapping when the generated client and tenant context exist.
 */
export function mapPrismaError(error: unknown): AppException | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name !== 'PrismaClientKnownRequestError' || typeof candidate.code !== 'string') {
    return undefined;
  }

  switch (candidate.code) {
    case 'P2002':
      return new AppException('DUPLICATE_VERSION');
    case 'P2003':
    case 'P2025':
      return new AppException('DOCUMENT_NOT_FOUND');
    default:
      return undefined;
  }
}
