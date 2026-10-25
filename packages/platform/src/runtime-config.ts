/**
 * Runtime configuration: which backend this build talks to and how.
 *
 * Two layers, the later one winning field by field:
 *
 *   1. Build-time defaults — the app inlines `PUBLIC_AWCMS_*` variables when
 *      it is bundled (apps/mobile/lynx.config.ts). One bundle per environment.
 *   2. `lynx.__globalProps` — set by the host at mount time (`<lynx-view
 *      global-props>` on the Web, `globalProps` on the native LynxView builder,
 *      Lynxtron's `lynxPreference`). Lets one signed native binary point at a
 *      staging or production backend without rebuilding the bundle.
 *
 * Nothing here is secret. A value that must stay secret (a machine credential,
 * a provider key) never belongs in a client bundle or in globalProps —
 * docs/security.md explains why and what to do instead.
 */

export type BackendKind = 'awcms' | 'awcms-one';
export type AppLocale = 'en' | 'id';

export interface RuntimeConfig {
  /** `awcms` = staff/member app against ahliweb/awcms; `awcms-one` = customer app against ahliweb/awcms-one commerce. */
  backend: BackendKind;
  /** Origin (or origin + path prefix) of the AWCMS backend, e.g. `https://cms.example.id`. No trailing slash. */
  apiBaseUrl: string;
  /** awcms-one only: origin of the deployed Astro storefront that serves the static catalog index. */
  storefrontOrigin: string | null;
  /** awcms only: tenant UUID sent as `X-AWCMS-Tenant-ID`. Null = let login ask for a membership. */
  tenantId: string | null;
  locale: AppLocale;
  appName: string;
  environment: 'development' | 'production';
}

export class RuntimeConfigError extends Error {
  readonly field: keyof RuntimeConfig;
  constructor(field: keyof RuntimeConfig, message: string) {
    super(`${field}: ${message}`);
    this.name = 'RuntimeConfigError';
    this.field = field;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * http is accepted only for loopback and private-LAN hosts, the AWCMS
 * offline-LAN deployment profile; every other backend must be https.
 *
 * Parsed with a regular expression on purpose: the Lynx background thread
 * has no `URL` global (docs/lynx-runtime.md), and this code runs there.
 */
const BASE_URL_PATTERN = /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:]+\])(:\d{1,5})?(\/[^?#\s]*)?$/i;

export function normaliseBaseUrl(raw: string, field: keyof RuntimeConfig): string {
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(raw)) {
    throw new RuntimeConfigError(field, 'must not embed credentials');
  }
  if (/[?#]/.test(raw)) throw new RuntimeConfigError(field, 'must not carry a query or fragment');
  const match = BASE_URL_PATTERN.exec(raw);
  if (!match) throw new RuntimeConfigError(field, `"${raw}" is not an absolute http(s) URL`);
  const scheme = (match[1] ?? '').toLowerCase();
  const host = (match[2] ?? '').toLowerCase();
  const port = match[3] ?? '';
  const path = (match[4] ?? '').replace(/\/+$/, '');
  if (scheme === 'http' && !isLocalHost(host)) {
    throw new RuntimeConfigError(field, 'must be https (http only for localhost / private LAN)');
  }
  return `${scheme}://${host}${port}${path}`;
}

export function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '10.0.2.2' ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) ||
    host.endsWith('.local')
  );
}

export function resolveRuntimeConfig(
  defaults: Partial<Record<keyof RuntimeConfig, unknown>>,
  globalProps?: unknown,
): RuntimeConfig {
  const props =
    globalProps && typeof globalProps === 'object' ? (globalProps as Record<string, unknown>) : {};
  const pick = (key: keyof RuntimeConfig) => text(props[key]) ?? text(defaults[key]);

  const backend = pick('backend') ?? 'awcms-one';
  if (backend !== 'awcms' && backend !== 'awcms-one') {
    throw new RuntimeConfigError('backend', `must be "awcms" or "awcms-one", got "${backend}"`);
  }
  const apiBase = pick('apiBaseUrl');
  if (!apiBase) throw new RuntimeConfigError('apiBaseUrl', 'is required');
  const storefront = pick('storefrontOrigin');
  const tenantId = pick('tenantId');
  if (tenantId && !UUID_PATTERN.test(tenantId)) {
    throw new RuntimeConfigError('tenantId', 'must be a UUID');
  }
  const locale = pick('locale') === 'en' ? 'en' : 'id';
  const environment = pick('environment') === 'production' ? 'production' : 'development';

  return {
    backend,
    apiBaseUrl: normaliseBaseUrl(apiBase, 'apiBaseUrl'),
    storefrontOrigin: storefront ? normaliseBaseUrl(storefront, 'storefrontOrigin') : null,
    tenantId: tenantId ?? null,
    locale,
    appName: pick('appName') ?? 'AWCMS Lynx',
    environment,
  };
}
