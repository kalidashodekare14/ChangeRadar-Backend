import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { IncomingMessage } from 'node:http';
import { Observable, map } from 'rxjs';
import { getCorrelationId } from '../http/correlation';
import { PaginatedData } from '../pagination/paginated-response';

function isEnvelope(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'success' in value;
}

/** Wraps successful HTTP responses in the documented envelope (§10.2). */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<IncomingMessage>();
    const correlationId = getCorrelationId(request);

    return next.handle().pipe(
      map((data: unknown) => {
        if (isEnvelope(data)) return data;
        if (data instanceof PaginatedData) {
          return {
            success: true,
            data: data.items,
            meta: data.meta,
            correlationId,
          };
        }
        return { success: true, data, correlationId };
      }),
    );
  }
}
