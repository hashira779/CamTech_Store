import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import type { ApiSuccess } from '@mystore/contracts';
import { getRequestId } from '../context/request-id.middleware';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator';

/**
 * Wraps every successful controller return value in the standard success
 * envelope (spec §102): { success:true, data, requestId }.
 *
 * Controllers therefore return plain domain DTOs; the envelope is applied once,
 * consistently, for all clients. Routes marked @SkipEnvelope() pass through raw.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccess<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const requestId = getRequestId(req);
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        requestId,
      })),
    );
  }
}
