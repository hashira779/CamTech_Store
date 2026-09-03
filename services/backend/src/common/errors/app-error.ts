import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain/application error with a stable machine-readable `code` (spec §102).
 *
 * Throw this from services/domain instead of raw HttpException so every error
 * surfaces as { success:false, code, message, requestId } to all clients.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Array<{ field: string; message: string }>,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(code: string, message: string): AppError {
    return new AppError(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(code, message, HttpStatus.CONFLICT);
  }

  static forbidden(code: string, message: string): AppError {
    return new AppError(code, message, HttpStatus.FORBIDDEN);
  }

  static unauthorized(code: string, message: string): AppError {
    return new AppError(code, message, HttpStatus.UNAUTHORIZED);
  }
}
