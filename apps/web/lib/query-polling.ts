import type { Query } from '@tanstack/react-query';

/**
 * Polling helpers for pages that auto-refresh.
 *
 * Retrying or polling an authorization failure is pointless and harmful: the
 * answer will not change, and a page with a 5s interval turns a single 403 into
 * a permanent request storm against an endpoint that is already refusing it.
 * One denied Control Center page was issuing a request every 5 seconds
 * indefinitely, which both buries the real signal in the API logs and makes the
 * console look broken rather than restricted.
 */

const AUTH_FAILURE_CODES = new Set(['UNAUTHORIZED', 'FORBIDDEN']);

/** True when an error represents an authorization verdict rather than a fault. */
export function isAuthFailure(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  if (code && AUTH_FAILURE_CODES.has(code)) return true;
  const status = (error as { status?: number }).status;
  return status === 401 || status === 403;
}

/**
 * A `refetchInterval` that polls normally but goes quiet once the query is
 * failing on authorization.
 *
 *   useQuery({ ..., refetchInterval: stopPollingOnAuthFailure(10_000) })
 */
export function stopPollingOnAuthFailure(intervalMs: number) {
  return (query: Query<any, any, any, any>): number | false =>
    isAuthFailure(query.state.error) ? false : intervalMs;
}

/** A `retry` predicate that retries faults but accepts an auth verdict at once. */
export function retryUnlessAuthFailure(maxRetries = 1) {
  return (failureCount: number, error: unknown): boolean =>
    !isAuthFailure(error) && failureCount < maxRetries;
}
