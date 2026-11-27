import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER, getCorrelationId } from '../http/correlation';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = getCorrelationId(request);
    (request as Request & { correlationId: string }).correlationId = correlationId;
    (request as Request & { id?: string }).id ??= correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
