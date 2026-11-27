import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception';

export interface CurrentUserData {
  id: string;
  sessionId: string;
  email: string;
  name: string;
}

/** The identity attached by AuthGuard after JWT + session validation. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserData => {
    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    if (!request.user) throw new AppException('UNAUTHENTICATED');
    return request.user;
  },
);
