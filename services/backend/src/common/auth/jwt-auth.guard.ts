import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@mystore/contracts';
import { AppError } from '../errors/app-error';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { JwtPayload } from './auth.types';

/**
 * Authenticates every request from the Bearer JWT (spec §66) unless the route
 * is @Public. On success attaches a trusted AuthenticatedUser to the request.
 *
 * NOTE (spec §66): the org id and roles come from the SIGNED token, never from
 * client-supplied headers/body — that is what prevents tenant spoofing.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(req);
    if (!token) {
      throw AppError.unauthorized('MISSING_TOKEN', 'Missing Bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      organizationId: payload.org,
      roles: payload.roles,
      permissions: payload.perms,
    };
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : undefined;
  }
}
