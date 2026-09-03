import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '@mystore/contracts';
import { AppError } from '../errors/app-error';

/**
 * Injects the authenticated principal into a controller handler.
 * Throws if used on a route that was not authenticated (programmer error).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) {
      throw AppError.unauthorized('UNAUTHENTICATED', 'Authentication required');
    }
    return req.user;
  },
);
