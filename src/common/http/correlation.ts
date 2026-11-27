import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

export const CORRELATION_ID_HEADER = 'x-request-id';

type CorrelatedRequest = IncomingMessage & {
  correlationId?: string;
  id?: string | number;
};

/** Reads the request correlation ID set by pino-http or the correlation middleware. */
export function getCorrelationId(request: IncomingMessage): string {
  const candidate =
    (request as CorrelatedRequest).correlationId ??
    (request as CorrelatedRequest).id ??
    request.headers[CORRELATION_ID_HEADER];

  if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  if (typeof candidate === 'number') return String(candidate);
  if (Array.isArray(candidate) && typeof candidate[0] === 'string') return candidate[0];
  return randomUUID();
}
