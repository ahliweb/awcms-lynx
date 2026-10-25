/**
 * The one place that touches `fetch`.
 *
 * Runs in the Lynx background thread, which has `fetch` but no `URL`,
 * `URLSearchParams`, usually no `AbortController`, and no CORS (so no
 * preflight to worry about). Hence: query strings are built with
 * `encodeURIComponent`, the base URL is joined by string ops, and timeouts
 * race the request against a `setTimeout` promise (aborting too when an
 * `AbortController` happens to exist, so the socket is released).
 *
 * Shared envelope (ahliweb/awcms `src/modules/_shared/api-response.ts`):
 *   success  { success: true,  data, meta }
 *   error    { success: false, error: { code, message, details? }, meta }
 * 204 has no body. Any 2xx is success: awcms-one documents the OTP request as
 * 202 but returns 200, so we never compare against one specific code.
 *
 * `X-Correlation-ID` is generated per request; the server echoes it and we put
 * it on every error so a user report can be matched to a server log line.
 */

import { type ClientConfig, DEFAULT_TIMEOUT_MS } from './config.ts';
import { AwcmsApiError, configError } from './errors.ts';
import { createRandomId, isValidIdempotencyKey } from './ids.ts';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  bearer?: string | null;
  tenantId?: string | null;
  idempotencyKey?: string;
  /** Overrides `config.apiBaseUrl` (the storefront static index). */
  baseUrl?: string;
  /** Default true. False = the body is raw JSON (feed.json, static index), not the envelope. */
  envelope?: boolean;
}

export interface HttpClient {
  request<T>(options: RequestOptions): Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `base` + `path` with exactly one slash between them. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** `?a=1&b=x%20y`, skipping null/undefined; empty string when nothing remains. */
export function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (value === null || value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/** `Retry-After` is delta-seconds on the backend's 429s; HTTP-dates are not used, so are ignored. */
export function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  return Math.ceil(Number(trimmed));
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

interface RawResponse {
  status: number;
  correlationId: string | null;
  retryAfterSeconds: number | null;
  text: string;
}

export function createHttpClient(config: ClientConfig): HttpClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const randomId = config.randomId ?? createRandomId;

  const doFetch = (url: string, init: RequestInit): Promise<Response> => {
    if (config.fetch) return config.fetch(url, init);
    if (typeof globalThis.fetch !== 'function') {
      throw configError('NO_FETCH', 'No fetch implementation is available in this runtime');
    }
    return globalThis.fetch(url, init);
  };

  async function request<T>(options: RequestOptions): Promise<T> {
    if (options.idempotencyKey !== undefined && !isValidIdempotencyKey(options.idempotencyKey)) {
      throw configError(
        'IDEMPOTENCY_KEY_INVALID',
        'Idempotency-Key must be 1-255 visible ASCII characters',
      );
    }

    const url =
      joinUrl(options.baseUrl ?? config.apiBaseUrl, options.path) + buildQuery(options.query);
    const correlationId = randomId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': config.locale,
      'X-Correlation-ID': correlationId,
    };
    if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`;
    if (options.tenantId) headers['X-AWCMS-Tenant-ID'] = options.tenantId;
    if (options.idempotencyKey !== undefined) headers['Idempotency-Key'] = options.idempotencyKey;
    // The Origin hint is for API calls only, never for the storefront's static files.
    if (config.originHeader && options.baseUrl === undefined) headers.Origin = config.originHeader;

    const init: RequestInit = { method: options.method, headers };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) init.signal = controller.signal;

    const exchange = async (): Promise<RawResponse> => {
      let response: Response;
      try {
        response = await doFetch(url, init);
      } catch (cause) {
        if (cause instanceof AwcmsApiError) throw cause;
        throw new AwcmsApiError({
          kind: 'network',
          status: 0,
          code: 'NETWORK_ERROR',
          message: `Network request failed${cause instanceof Error ? `: ${cause.message}` : ''}`,
          correlationId,
        });
      }
      let text: string;
      try {
        text = await response.text();
      } catch {
        throw new AwcmsApiError({
          kind: 'network',
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'Network request failed while reading the response body',
          correlationId,
        });
      }
      return {
        status: response.status,
        correlationId: response.headers.get('X-Correlation-ID') ?? correlationId,
        retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
        text,
      };
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(
          new AwcmsApiError({
            kind: 'timeout',
            status: 0,
            code: 'TIMEOUT',
            message: `Request timed out after ${timeoutMs} ms`,
            correlationId,
          }),
        );
      }, timeoutMs);
    });

    let raw: RawResponse;
    try {
      raw = await Promise.race([exchange(), timeout]);
    } finally {
      clearTimeout(timer);
    }

    return interpret<T>(raw, options.envelope !== false);
  }

  return { request };
}

function interpret<T>(raw: RawResponse, envelope: boolean): T {
  const { status, correlationId, retryAfterSeconds, text } = raw;
  const parsed = text.trim() === '' ? null : tryParseJson(text);

  if (status < 200 || status >= 300) {
    throw httpError(status, parsed, correlationId, retryAfterSeconds);
  }

  const badEnvelope = (message: string) =>
    new AwcmsApiError({
      kind: 'envelope',
      status,
      code: 'BAD_ENVELOPE',
      message,
      correlationId,
    });

  if (parsed === null) {
    // 204 (or an empty 2xx): nothing to return. A body-less 200 on a call that
    // expects data surfaces as `undefined`, which callers treat as malformed.
    return undefined as T;
  }
  if (!parsed.ok) throw badEnvelope('Response body is not valid JSON');
  if (!envelope) return parsed.value as T;

  const value = parsed.value;
  if (isRecord(value) && value.success === true) return value.data as T;
  if (isRecord(value) && value.success === false) {
    throw httpError(status, parsed, correlationId, retryAfterSeconds);
  }
  throw badEnvelope('Response is not a { success, data } envelope');
}

function httpError(
  status: number,
  parsed: { ok: true; value: unknown } | { ok: false } | null,
  correlationId: string | null,
  retryAfterSeconds: number | null,
): AwcmsApiError {
  let code = `HTTP_${status}`;
  let message = `Request failed with status ${status}`;
  let details: unknown;
  if (parsed?.ok && isRecord(parsed.value) && isRecord(parsed.value.error)) {
    const error = parsed.value.error;
    if (typeof error.code === 'string' && error.code !== '') code = error.code;
    if (typeof error.message === 'string' && error.message !== '') message = error.message;
    details = error.details;
  }
  return new AwcmsApiError({
    kind: 'http',
    status,
    code,
    message,
    details,
    correlationId,
    retryAfterSeconds,
  });
}
