import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiError } from '@mystore/contracts';
import { getRequestId } from '../context/request-id.middleware';

/**
 * Converts every thrown error into the standard error envelope (spec §102)
 * and NEVER leaks stack traces to clients (spec §102, §66).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = getRequestId(req);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: ApiError['details'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = mapStatusToCode(status);
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        code = (b.code as string) ?? mapStatusToCode(status);
        message = normalizeMessage(b.message) ?? message;
        details = (b.details as ApiError['details']) ?? undefined;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Map common Prisma errors to clean HTTP status codes instead of 500,
      // so e.g. a unique-constraint race returns 409, not INTERNAL_ERROR.
      const mapped = mapPrismaError(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
    }

    // Log full detail server-side only.
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${req.method} ${req.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${requestId}] ${req.method} ${req.url} -> ${status} ${code}: ${message}`);
    }

    const payload: ApiError = { success: false, code, message, requestId };
    if (details) payload.details = details;
    res.status(status).json(payload);
  }
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  status: number;
  code: string;
  message: string;
} {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation.
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'field');
      return {
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_RESOURCE',
        message: `A record with the same ${fields} already exists`,
      };
    }
    case 'P2025':
      // Record required but not found (e.g. update/delete on missing row).
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'The requested record was not found',
      };
    case 'P2003':
      // Foreign-key constraint failed.
      return {
        status: HttpStatus.CONFLICT,
        code: 'FK_CONSTRAINT',
        message: 'The operation references a related record that does not exist',
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      };
  }
}

function normalizeMessage(message: unknown): string | undefined {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('; ');
  return undefined;
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
