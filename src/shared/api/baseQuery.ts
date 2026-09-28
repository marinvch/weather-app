import { fetchBaseQuery, retry } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

/**
 * The one transport every base API is built on.
 *
 * `fetchBaseQuery` on its own has no timeout and no retry. A request that
 * hangs — a mobile connection that drops mid-response, a host that accepts the
 * socket and never answers — leaves the dashboard skeleton on screen forever,
 * and a single 503 from a free public API shows an error for something that
 * would have succeeded a second later.
 */

/** Long enough for a slow mobile connection, short enough that a hung request
 * becomes an actionable error rather than an endless skeleton. */
export const REQUEST_TIMEOUT_MS = 12_000;

/** Retries after the first attempt. RTK's default is five, which with its
 * backoff keeps a failed panel loading for most of a minute. */
export const MAX_RETRIES = 2;

/**
 * Worth asking again: the network failed, the request timed out, the server
 * erred, or it asked us to slow down. A 4xx other than 429 means the request
 * itself is wrong — repeating it cannot help and only spends the free-tier
 * rate limit. A parse error means the host answered with something unreadable,
 * which it will do again.
 */
export function isTransientError(error: FetchBaseQueryError): boolean {
  const { status } = error;
  if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR") return true;
  if (typeof status === "number") return status === 429 || status >= 500;
  return false;
}

export interface BaseQueryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  /** Injected in tests; defaults to RTK's exponential backoff. */
  backoff?: (attempt: number, maxRetries: number) => Promise<void>;
  /** Injected in tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * A `fetchBaseQuery` for one host, with a timeout and a bounded retry on
 * transient failures only.
 */
export function createBaseQuery(
  baseUrl: string,
  {
    timeoutMs = REQUEST_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
    backoff,
    fetchFn,
  }: BaseQueryOptions = {},
) {
  return retry(fetchBaseQuery({ baseUrl, timeout: timeoutMs, fetchFn }), {
    // Spread only when given. RTK merges `{ backoff: defaultBackoff, ...ours }`,
    // so an explicit `backoff: undefined` overwrites its default and every
    // retry throws "options.backoff is not a function".
    ...(backoff && { backoff }),
    // `attempt` is 1 after the first failure, so this allows exactly
    // `maxRetries` further attempts.
    retryCondition: (error, _args, { attempt }) =>
      attempt <= maxRetries && isTransientError(error as FetchBaseQueryError),
  });
}
