import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Attaches a correlation/request id to every request (spec §70, §102).
 * Honours an inbound `x-request-id` (e.g. from an API gateway) or mints one.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length <= 128 ? incoming : `req_${randomUUID()}`;
    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}

export function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string }).requestId ?? 'req_unknown';
}
