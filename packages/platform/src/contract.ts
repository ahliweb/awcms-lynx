/**
 * The host-bridge contract.
 *
 * Every host that renders this app — the native iOS, Android and HarmonyOS
 * shells, the browser page that mounts `<lynx-view>`, and the Lynxtron desktop
 * main process — answers the same small set of methods. The ReactLynx code
 * never asks which host it is on to decide *how* to store a token; it calls
 * `secureStorage.set` and the host picks Keychain, Android Keystore, HarmonyOS
 * HUKS, the OS keyring or browser storage. That is the whole point of a
 * contract: one call site, one behaviour to test, per-host implementations
 * that can be reviewed in isolation (docs/adr/0003-host-bridge-contract.md).
 *
 * Wire format (identical on every host):
 *
 *   call(method: HostMethod, params: object, callback: (reply: HostReply) => void)
 *
 * A host may hand the reply back as an object or as its JSON string (some
 * native module bridges only pass strings); `parseHostReply` accepts both.
 *
 * This file has no runtime dependency on Lynx, the DOM or Node, so native and
 * web host authors can read it as the single source of truth.
 */

/** Name of the custom NativeModule a native host registers. */
export const HOST_BRIDGE_MODULE = 'AwcmsHostBridge';

/** Bumped when a method is added or a shape changes; hosts report theirs in `app.info`. */
export const HOST_BRIDGE_VERSION = 1;

export type HostKind = 'ios' | 'android' | 'harmony' | 'web' | 'desktop' | 'explorer';

/**
 * Where `secureStorage` really keeps data on this host. The app shows it on the
 * settings screen and refuses to call a session "secure" when it is `memory`
 * or `browser-storage` — an honest label beats an implied guarantee.
 */
export type SecureStorageBackend =
  | 'keychain'
  | 'android-keystore'
  | 'harmony-huks'
  | 'os-keyring'
  /** A file in the per-user app-data directory, owner-only permissions, NOT encrypted at rest. */
  | 'app-file'
  | 'browser-storage'
  | 'memory';

export interface AppInfo {
  host: HostKind;
  hostBridgeVersion: number;
  appVersion: string;
  secureStorage: SecureStorageBackend;
}

export interface HostMethodMap {
  'secureStorage.get': { params: { key: string }; result: { value: string | null } };
  'secureStorage.set': { params: { key: string; value: string }; result: { stored: true } };
  'secureStorage.delete': { params: { key: string }; result: { deleted: true } };
  'app.info': { params: Record<string, never>; result: AppInfo };
  /** Opens an http(s) URL in the system browser. Hosts MUST refuse any other scheme. */
  'link.open': { params: { url: string }; result: { opened: boolean } };
}

export type HostMethod = keyof HostMethodMap;

export const HOST_METHODS: readonly HostMethod[] = [
  'secureStorage.get',
  'secureStorage.set',
  'secureStorage.delete',
  'app.info',
  'link.open',
] as const;

export type HostErrorCode =
  | 'UNKNOWN_METHOD'
  | 'INVALID_PARAMS'
  | 'STORAGE_UNAVAILABLE'
  | 'FORBIDDEN_SCHEME'
  | 'HOST_ERROR';

export type HostReply<R> =
  | { ok: true; result: R }
  | { ok: false; error: { code: HostErrorCode; message: string } };

/** Keys are namespaced and restricted so a host can validate them without knowing the app. */
export const STORAGE_KEY_PATTERN = /^awcms-lynx:[a-z0-9:._-]{1,96}$/;

export function isHostMethod(value: unknown): value is HostMethod {
  return typeof value === 'string' && (HOST_METHODS as readonly string[]).includes(value);
}

export function parseHostReply<R>(raw: unknown): HostReply<R> {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: false, error: { code: 'HOST_ERROR', message: 'Host reply is not valid JSON' } };
    }
  }
  if (value && typeof value === 'object' && 'ok' in value) {
    const reply = value as { ok: unknown; result?: unknown; error?: unknown };
    if (reply.ok === true) return { ok: true, result: reply.result as R };
    if (reply.ok === false && reply.error && typeof reply.error === 'object') {
      const error = reply.error as { code?: unknown; message?: unknown };
      return {
        ok: false,
        error: {
          code: typeof error.code === 'string' ? (error.code as HostErrorCode) : 'HOST_ERROR',
          message: typeof error.message === 'string' ? error.message : 'Host error',
        },
      };
    }
  }
  return { ok: false, error: { code: 'HOST_ERROR', message: 'Host reply has no ok field' } };
}

export const MAX_STORAGE_VALUE_LENGTH = 16_384;
export const MAX_URL_LENGTH = 2_048;

export interface HostParamError {
  code: Extract<HostErrorCode, 'INVALID_PARAMS' | 'FORBIDDEN_SCHEME'>;
  field: string;
}

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
// Any C0 control, space or DEL anywhere in the URL is refused: browsers strip
// them, which is how `java\nscript:` smuggles a scheme past a naive check.
function hasControlOrSpace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}
const HTTP_URL_PATTERN = /^https?:\/\/([^/?#]*)([/?#].*)?$/i;
const AUTHORITY_PATTERN = /^(\[[0-9a-fA-F:.]+\]|[^:@[\]]+)(:\d{1,5})?$/;

function checkUrl(url: unknown): HostParamError | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) {
    return { code: 'INVALID_PARAMS', field: 'url' };
  }
  if (hasControlOrSpace(url)) return { code: 'INVALID_PARAMS', field: 'url' };
  const scheme = SCHEME_PATTERN.exec(url)?.[1]?.toLowerCase();
  if (!scheme) return { code: 'INVALID_PARAMS', field: 'url' };
  if (scheme !== 'http' && scheme !== 'https') return { code: 'FORBIDDEN_SCHEME', field: 'url' };
  const authority = HTTP_URL_PATTERN.exec(url)?.[1];
  // No userinfo (`https://trusted.example@evil.example/` is a phishing classic),
  // and a host is required (`https:///path`, `https:/example.com`).
  if (!authority || !AUTHORITY_PATTERN.test(authority))
    return { code: 'INVALID_PARAMS', field: 'url' };
  return null;
}

/**
 * Validates params for a method and names the error code a host must answer.
 * The native hosts implement the same rules; `hosts/contract-test-vectors.json`
 * is the shared specification and `__tests__/contract-vectors.test.ts`
 * replays it against the JS host.
 */
export function checkHostParams(method: HostMethod, params: unknown): HostParamError | null {
  const p =
    params && typeof params === 'object' && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {};
  const invalid = (field: string): HostParamError => ({ code: 'INVALID_PARAMS', field });
  switch (method) {
    case 'secureStorage.get':
    case 'secureStorage.delete':
      return typeof p.key === 'string' && STORAGE_KEY_PATTERN.test(p.key) ? null : invalid('key');
    case 'secureStorage.set':
      if (typeof p.key !== 'string' || !STORAGE_KEY_PATTERN.test(p.key)) return invalid('key');
      return typeof p.value === 'string' && p.value.length <= MAX_STORAGE_VALUE_LENGTH
        ? null
        : invalid('value');
    case 'link.open':
      return checkUrl(p.url);
    case 'app.info':
      return null;
  }
}

/** The offending field name, or null when valid. Kept for callers that only need a yes/no. */
export function validateHostParams(method: HostMethod, params: unknown): string | null {
  return checkHostParams(method, params)?.field ?? null;
}
