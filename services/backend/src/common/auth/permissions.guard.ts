import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@mystore/contracts';
import { AppError } from '../errors/app-error';
import { PERMISSIONS_KEY } from './permissions.decorator';

/**
 * Enforces route-declared permissions (spec §66, §68). Runs after JwtAuthGuard,
 * so req.user is populated. Denies with a stable FORBIDDEN code.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized('UNAUTHENTICATED', 'Authentication required');
    }

    const granted = new Set(user.permissions);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw AppError.forbidden(
        'INSUFFICIENT_PERMISSIONS',
        `Missing required permission(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
