/**
 * Standard API response envelope (spec §102).
 *
 * Every backend response is wrapped so that ALL clients (web, POS, mobile,
 * Telegram, partners) parse results the same way. Never leak stack traces.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  /** Optional field-level validation details. */
  details?: Array<{ field: string; message: string }>;
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Cursor/offset pagination metadata (spec §103). */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}
