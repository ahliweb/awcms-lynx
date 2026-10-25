/**
 * One error type for everything the client can fail with.
 *
 * The UI layer switches on `code` (stable, machine-readable, from the backend's
 * `error.code` or one of the client-side codes below) and shows its own
 * localised copy; `message` is for logs and is never shown verbatim to users.
 *
 * Client-side codes: NETWORK_ERROR, TIMEOUT, BAD_ENVELOPE (kinds network /
 * timeout / envelope), NOT_SIGNED_IN, WRONG_BACKEND, STOREFRONT_NOT_CONFIGURED,
 * IDEMPOTENCY_KEY_INVALID and friends (kind config).
 *
 * Nothing in here ever carries a token: the error records the response, never
 * the request headers.
 */

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'envelope' | 'config';

export interface ApiErrorInit {
  kind: ApiErrorKind;
  /** HTTP status, or 0 when there was no response at all. */
  status?: number;
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string | null;
  retryAfterSeconds?: number | null;
}

export class AwcmsApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** `X-Correlation-ID` echoed by the server (falls back to the id we sent). Quote it in bug reports. */
  readonly correlationId: string | null;
  /** From the `Retry-After` header of a 429, in whole seconds. */
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'AwcmsApiError';
    this.kind = init.kind;
    this.status = init.status ?? 0;
    this.code = init.code;
    this.details = init.details;
    this.correlationId = init.correlationId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

export function isApiError(e: unknown, code?: string): e is AwcmsApiError {
  return e instanceof AwcmsApiError && (code === undefined || e.code === code);
}

/** A caller-side mistake (not signed in, wrong backend, bad input) caught before any request. */
export function configError(code: string, message: string, details?: unknown): AwcmsApiError {
  return new AwcmsApiError({ kind: 'config', status: 0, code, message, details });
}
