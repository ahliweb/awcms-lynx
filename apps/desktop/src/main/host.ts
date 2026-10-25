/**
 * Desktop implementation of the host-bridge contract
 * (packages/platform/src/contract.ts), as a plain function so it runs under
 * `bun test` without Lynxtron. main.ts wires it to `-lynx-invoke`.
 *
 * The UI can reach exactly these five methods and nothing else: every call is
 * validated with the same `isHostMethod` / `checkHostParams` the other
 * hosts use, and a failure is a `{ ok: false }` reply, never an exception.
 */
import {
  checkHostParams,
  HOST_BRIDGE_VERSION,
  type HostErrorCode,
  type HostReply,
  isHostMethod,
} from '@awcms-lynx/platform/contract';

export interface DesktopStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export interface DesktopHostOptions {
  store: DesktopStore;
  appVersion: string;
  /** Opens a URL in the system browser (`shell.openExternal`); resolves whether it was handed off. */
  openExternal: (url: string) => Promise<boolean>;
}

export type DesktopHostHandler = (method: string, params: unknown) => Promise<HostReply<unknown>>;

function fail(code: HostErrorCode, message: string): HostReply<never> {
  return { ok: false, error: { code, message } };
}

/**
 * `checkHostParams` already requires an `http(s)://` prefix; parsing it with
 * `URL` as well rejects values the OS might interpret differently from us
 * (embedded whitespace or control characters, credentials) and hands the
 * normalised `href` to the OS.
 */
export function parseExternalUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function createDesktopHostHandler(options: DesktopHostOptions): DesktopHostHandler {
  const { store, appVersion, openExternal } = options;

  const storage = <R>(run: () => R): HostReply<R> => {
    try {
      return { ok: true, result: run() };
    } catch (error) {
      return fail(
        'STORAGE_UNAVAILABLE',
        error instanceof Error ? error.message : 'Secret storage failed',
      );
    }
  };

  return async (method, params) => {
    try {
      if (!isHostMethod(method)) return fail('UNKNOWN_METHOD', `Unknown host method "${method}"`);
      const invalid = checkHostParams(method, params);
      if (invalid) return fail(invalid.code, `Invalid ${invalid.field} for ${method}`);
      const p = (params ?? {}) as Record<string, string>;
      switch (method) {
        case 'secureStorage.get':
          return storage(() => ({ value: store.get(p.key as string) }));
        case 'secureStorage.set':
          return storage(() => {
            store.set(p.key as string, p.value as string);
            return { stored: true as const };
          });
        case 'secureStorage.delete':
          return storage(() => {
            store.delete(p.key as string);
            return { deleted: true as const };
          });
        case 'app.info':
          return {
            ok: true,
            result: {
              host: 'desktop',
              hostBridgeVersion: HOST_BRIDGE_VERSION,
              appVersion,
              secureStorage: 'app-file',
            },
          };
        case 'link.open': {
          const href = parseExternalUrl(p.url as string);
          if (!href) return fail('INVALID_PARAMS', 'URL could not be parsed');
          return { ok: true, result: { opened: await openExternal(href) } };
        }
      }
    } catch (error) {
      return fail('HOST_ERROR', error instanceof Error ? error.message : String(error));
    }
  };
}
