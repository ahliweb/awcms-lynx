import type { AsyncKeyValueStore, ClientConfig } from '../config.ts';

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string | undefined;
}

export type Handler = (req: RecordedRequest, index: number) => Response | Promise<Response>;

/** A fake `fetch` that records every request and answers through `handler`. */
export function fakeFetch(handler: Handler) {
  const calls: RecordedRequest[] = [];
  const impl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const rawBody = typeof init?.body === 'string' ? init.body : undefined;
    const req: RecordedRequest = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}) },
      body: rawBody === undefined ? undefined : JSON.parse(rawBody),
      rawBody,
    };
    calls.push(req);
    return handler(req, calls.length - 1);
  };
  return { fetch: impl as unknown as typeof fetch, calls };
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export const ok = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  json(status, { success: true, data, meta: {} }, headers);

export const fail = (
  status: number,
  code: string,
  message = code,
  details?: unknown,
  headers: Record<string, string> = {},
) => json(status, { success: false, error: { code, message, details }, meta: {} }, headers);

export class MemoryStore implements AsyncKeyValueStore {
  readonly data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}

export const TENANT = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export function awcmsConfig(over: Partial<ClientConfig> = {}): ClientConfig {
  return {
    backend: 'awcms',
    apiBaseUrl: 'https://cms.example.id',
    storefrontOrigin: null,
    tenantId: TENANT,
    locale: 'id',
    randomId: () => 'corr-1',
    ...over,
  };
}

export function commerceConfig(over: Partial<ClientConfig> = {}): ClientConfig {
  return {
    backend: 'awcms-one',
    apiBaseUrl: 'https://api.shop.example.id',
    storefrontOrigin: 'https://shop.example.id',
    tenantId: null,
    locale: 'id',
    randomId: () => 'corr-1',
    ...over,
  };
}

export const ACCOUNT = {
  id: 'acc-1',
  name: 'Siti',
  email: 'siti@example.id',
  phone: null,
  level: 'silver',
  createdAt: '2026-01-01T00:00:00Z',
  historyFrom: null,
  marketingConsent: false,
};
