import { describe, expect, test } from 'bun:test';
import { isApiError } from '../errors.ts';
import { buildQuery, createHttpClient, joinUrl, parseRetryAfter } from '../http.ts';
import { awcmsConfig, fail, fakeFetch, json, ok } from './testkit.ts';

function client(handler: Parameters<typeof fakeFetch>[0], over = {}) {
  const f = fakeFetch(handler);
  return { http: createHttpClient(awcmsConfig({ fetch: f.fetch, ...over })), calls: f.calls };
}

describe('envelope handling', () => {
  test('returns data from a success envelope', async () => {
    const { http } = client(() => ok({ hello: 'world' }));
    expect(await http.request({ method: 'GET', path: '/api/v1/x' })).toEqual({ hello: 'world' });
  });

  test('204 resolves to undefined without parsing a body', async () => {
    const { http } = client(() => new Response(null, { status: 204 }));
    expect(await http.request({ method: 'DELETE', path: '/api/v1/x' })).toBeUndefined();
  });

  test('any 2xx is success (202, 201)', async () => {
    for (const status of [201, 202]) {
      const { http } = client(() => ok({ sent: true }, status));
      expect(await http.request({ method: 'POST', path: '/p', body: {} })).toEqual({ sent: true });
    }
  });

  test('error envelope becomes AwcmsApiError with code, message, details, status', async () => {
    const { http } = client(() =>
      fail(400, 'VALIDATION_ERROR', 'bad', [{ field: 'q', message: 'x' }]),
    );
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(isApiError(error, 'VALIDATION_ERROR')).toBe(true);
    expect(error).toMatchObject({
      kind: 'http',
      status: 400,
      message: 'bad',
      details: [{ field: 'q', message: 'x' }],
    });
  });

  test('non-envelope error body still yields an HTTP_<status> error', async () => {
    const { http } = client(() => new Response('<html>502</html>', { status: 502 }));
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(error).toMatchObject({ kind: 'http', status: 502, code: 'HTTP_502' });
  });

  test('non-JSON 200 is BAD_ENVELOPE and keeps the status', async () => {
    const { http } = client(() => new Response('hello', { status: 200 }));
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(error).toMatchObject({ kind: 'envelope', code: 'BAD_ENVELOPE', status: 200 });
  });

  test('JSON that is not an envelope is BAD_ENVELOPE', async () => {
    const { http } = client(() => json(200, { items: [] }));
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(error).toMatchObject({ kind: 'envelope', code: 'BAD_ENVELOPE' });
  });

  test('envelope:false returns raw JSON', async () => {
    const { http } = client(() => json(200, [{ id: 1 }]));
    expect(await http.request({ method: 'GET', path: '/feed.json', envelope: false })).toEqual([
      { id: 1 },
    ]);
  });
});

describe('correlation id and Retry-After', () => {
  test('sends X-Correlation-ID and captures the echoed one', async () => {
    const { http, calls } = client(() =>
      fail(500, 'BOOM', 'boom', undefined, { 'X-Correlation-ID': 'server-echo' }),
    );
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(calls[0]?.headers['X-Correlation-ID']).toBe('corr-1');
    expect(isApiError(error) && error.correlationId).toBe('server-echo');
  });

  test('falls back to the id we sent when the server does not echo', async () => {
    const { http } = client(() => fail(500, 'BOOM'));
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(isApiError(error) && error.correlationId).toBe('corr-1');
  });

  test('parses Retry-After seconds on a 429', async () => {
    const { http } = client(() =>
      fail(429, 'RATE_LIMITED', 'slow', undefined, { 'Retry-After': '42' }),
    );
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 42 });
  });

  test('parseRetryAfter edge cases', () => {
    expect(parseRetryAfter('7')).toBe(7);
    expect(parseRetryAfter(' 1.2 ')).toBe(2);
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('-3')).toBeNull();
  });
});

describe('transport failures', () => {
  test('network error -> kind network, status 0, NETWORK_ERROR', async () => {
    const { http } = client(() => {
      throw new TypeError('connection refused');
    });
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(error).toMatchObject({ kind: 'network', status: 0, code: 'NETWORK_ERROR' });
  });

  test('timeout -> kind timeout, TIMEOUT, without hanging', async () => {
    const { http } = client(() => new Promise<Response>(() => {}), { timeoutMs: 20 });
    const started = Date.now();
    const error = await http.request({ method: 'GET', path: '/p' }).catch((e) => e);
    expect(error).toMatchObject({ kind: 'timeout', status: 0, code: 'TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('aborts the request when AbortController exists', async () => {
    let signal: AbortSignal | undefined;
    const impl = ((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    const http = createHttpClient(awcmsConfig({ fetch: impl, timeoutMs: 10 }));
    await http.request({ method: 'GET', path: '/p' }).catch(() => {});
    expect(signal?.aborted).toBe(true);
  });

  test('works when AbortController is missing (Lynx)', async () => {
    const original = globalThis.AbortController;
    // @ts-expect-error simulate the Lynx runtime
    globalThis.AbortController = undefined;
    try {
      let sawSignal = true;
      const f = fakeFetch((req) => {
        sawSignal = 'signal' in req;
        return ok(1);
      });
      const http = createHttpClient(awcmsConfig({ fetch: f.fetch }));
      expect(await http.request({ method: 'GET', path: '/p' })).toBe(1);
      expect(sawSignal).toBe(false);
      const hang = createHttpClient(
        awcmsConfig({
          fetch: (() => new Promise<Response>(() => {})) as unknown as typeof fetch,
          timeoutMs: 10,
        }),
      );
      expect(await hang.request({ method: 'GET', path: '/p' }).catch((e) => e)).toMatchObject({
        code: 'TIMEOUT',
      });
    } finally {
      globalThis.AbortController = original;
    }
  });
});

describe('request building', () => {
  test('joinUrl never doubles or drops slashes', () => {
    expect(joinUrl('https://a.id', '/api/v1/x')).toBe('https://a.id/api/v1/x');
    expect(joinUrl('https://a.id/', 'api/v1/x')).toBe('https://a.id/api/v1/x');
    expect(joinUrl('https://a.id//', '//api')).toBe('https://a.id/api');
    expect(joinUrl('https://a.id/prefix', '/x')).toBe('https://a.id/prefix/x');
  });

  test('query skips null/undefined and encodes unicode and reserved characters', () => {
    expect(buildQuery(undefined)).toBe('');
    expect(buildQuery({ a: null, b: undefined })).toBe('');
    expect(buildQuery({ q: 'kopi susu & roti', n: 5, ok: false, skip: null })).toBe(
      '?q=kopi%20susu%20%26%20roti&n=5&ok=false',
    );
    expect(buildQuery({ 'k ey': 'é日本' })).toBe('?k%20ey=%C3%A9%E6%97%A5%E6%9C%AC');
  });

  test('builds the final URL from base, path and query', async () => {
    const { http, calls } = client(() => ok(1), { apiBaseUrl: 'https://cms.example.id/' });
    await http.request({ method: 'GET', path: '/api/v1/x', query: { q: 'a b', z: undefined } });
    expect(calls[0]?.url).toBe('https://cms.example.id/api/v1/x?q=a%20b');
  });

  test('baseUrl overrides apiBaseUrl', async () => {
    const { http, calls } = client(() => json(200, []));
    await http.request({
      method: 'GET',
      path: '/index/produk.json',
      baseUrl: 'https://shop.example.id',
      envelope: false,
    });
    expect(calls[0]?.url).toBe('https://shop.example.id/index/produk.json');
  });

  test('standard headers; Content-Type only with a body', async () => {
    const { http, calls } = client(() => ok(1));
    await http.request({ method: 'GET', path: '/p' });
    await http.request({ method: 'POST', path: '/p', body: { a: 1 } });
    expect(calls[0]?.headers).toMatchObject({
      Accept: 'application/json',
      'Accept-Language': 'id',
    });
    expect(calls[0]?.headers['Content-Type']).toBeUndefined();
    expect(calls[1]?.headers['Content-Type']).toBe('application/json');
    expect(calls[1]?.body).toEqual({ a: 1 });
  });

  test('bearer and tenant are only sent when the caller passes them', async () => {
    const { http, calls } = client(() => ok(1));
    await http.request({ method: 'GET', path: '/p' });
    await http.request({ method: 'GET', path: '/p', bearer: 'tok', tenantId: 'tid' });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
    expect(calls[1]?.headers.Authorization).toBe('Bearer tok');
    expect(calls[1]?.headers['X-AWCMS-Tenant-ID']).toBe('tid');
  });

  test('originHeader is sent as Origin on API calls but not on baseUrl overrides', async () => {
    const { http, calls } = client(() => json(200, { success: true, data: 1 }), {
      originHeader: 'https://shop.example.id',
    });
    await http.request({ method: 'GET', path: '/p' });
    await http.request({
      method: 'GET',
      path: '/i.json',
      baseUrl: 'https://x.id',
      envelope: false,
    });
    expect(calls[0]?.headers.Origin).toBe('https://shop.example.id');
    expect(calls[1]?.headers.Origin).toBeUndefined();
  });

  test('no Origin when originHeader is null/unset', async () => {
    const { http, calls } = client(() => ok(1), { originHeader: null });
    await http.request({ method: 'GET', path: '/p' });
    expect(calls[0]?.headers.Origin).toBeUndefined();
  });

  test('valid idempotency key is sent; invalid ones are rejected before fetch', async () => {
    const { http, calls } = client(() => ok(1));
    await http.request({ method: 'POST', path: '/p', body: {}, idempotencyKey: 'abc-123' });
    expect(calls[0]?.headers['Idempotency-Key']).toBe('abc-123');
    for (const bad of ['', 'has space', 'tab\t', 'é', 'x'.repeat(256)]) {
      const error = await http
        .request({ method: 'POST', path: '/p', body: {}, idempotencyKey: bad })
        .catch((e) => e);
      expect(error).toMatchObject({ kind: 'config', code: 'IDEMPOTENCY_KEY_INVALID' });
    }
    expect(calls).toHaveLength(1);
    // 255 visible ASCII chars is the maximum and is accepted
    await http.request({ method: 'POST', path: '/p', body: {}, idempotencyKey: 'x'.repeat(255) });
    expect(calls).toHaveLength(2);
  });

  test('uses a different correlation id per request by default', async () => {
    const f = fakeFetch(() => ok(1));
    const http = createHttpClient({ ...awcmsConfig({ fetch: f.fetch }), randomId: undefined });
    await http.request({ method: 'GET', path: '/p' });
    await http.request({ method: 'GET', path: '/p' });
    expect(f.calls[0]?.headers['X-Correlation-ID']).not.toBe(
      f.calls[1]?.headers['X-Correlation-ID'],
    );
  });
});
