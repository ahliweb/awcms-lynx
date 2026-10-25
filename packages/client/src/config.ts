/**
 * Client configuration. Structurally a superset of the platform package's
 * `RuntimeConfig` (backend / apiBaseUrl / storefrontOrigin / tenantId / locale),
 * so the app can pass its resolved runtime config straight in.
 *
 * `fetch`, `randomId` and `now` are injection points for tests and for hosts
 * that supply their own transport; production code leaves them undefined.
 */

export type BackendKind = 'awcms' | 'awcms-one';

export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ClientConfig {
  backend: BackendKind;
  /** Origin (plus optional path prefix) of the backend, without a trailing slash. */
  apiBaseUrl: string;
  /** awcms-one only: origin of the Astro storefront serving `/index/*.json`. */
  storefrontOrigin: string | null;
  /** awcms only: sent as `X-AWCMS-Tenant-ID`. Never sent to commerce routes. */
  tenantId: string | null;
  locale: 'en' | 'id';
  /**
   * awcms-one on native builds against a multi-tenant backend: the server
   * resolves the tenant from `Origin`, which native HTTP stacks do not send
   * by themselves. When set it is sent as the `Origin` header (browsers ignore
   * it, `Origin` being a forbidden header name there).
   */
  originHeader?: string | null;
  /** Per-request timeout. Default 15000. */
  timeoutMs?: number;
  fetch?: typeof fetch;
  randomId?: () => string;
  now?: () => number;
}

export const DEFAULT_TIMEOUT_MS = 15000;
export const API_PREFIX = '/api/v1';
