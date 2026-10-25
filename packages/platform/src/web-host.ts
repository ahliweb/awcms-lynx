/**
 * Web host: answers the host-bridge contract on the page's main thread.
 *
 * `<lynx-view>` forwards every `NativeModules.<module>.call(...)` the app makes
 * on Lynx's background thread to `lynxView.onNativeModulesCall(name, data,
 * moduleName)`. The app's built-in module is called `bridge`, so this handler
 * only answers `moduleName === 'bridge'` and returns a `HostReply`; whatever
 * the handler returns becomes the callback argument in the app.
 *
 *   lynxView.onNativeModulesCall = createWebHostHandler({ appVersion: '1.0.0' });
 *
 * `secureStorage` here is browser storage: readable by any script on the same
 * origin, so `app.info` reports `secureStorage: 'browser-storage'` and the app
 * does not call the session "secure" (see contract.ts). The handler never
 * throws; every failure becomes a `{ ok: false }` reply.
 */
import {
  checkHostParams,
  HOST_BRIDGE_VERSION,
  type HostErrorCode,
  type HostMethod,
  type HostReply,
  isHostMethod,
} from './contract.ts';

export interface WebHostOptions {
  /** Defaults to `window.localStorage` or `window.sessionStorage` depending on `persistence`. */
  storage?: Storage;
  /**
   * `local` survives closing the tab (customer app); `session` is dropped with
   * the tab (staff app: a closed tab ends the session). Ignored when `storage`
   * is passed. Default `local`.
   */
  persistence?: 'local' | 'session';
  appVersion: string;
  /** Defaults to `window.open(url, '_blank', 'noopener,noreferrer')`. */
  /** Returns whether a window was opened; a popup blocker makes `window.open` return null. */
  openWindow?: (url: string) => boolean;
}

export type WebHostHandler = (
  name: string,
  data: unknown,
  moduleName: string,
) => HostReply<unknown> | undefined;

function fail(code: HostErrorCode, message: string): HostReply<never> {
  return { ok: false, error: { code, message } };
}

/**
 * Resolves the storage lazily and defensively: merely *reading*
 * `window.localStorage` throws a SecurityError when site data is blocked.
 */
function resolveStorage(options: WebHostOptions): Storage | null {
  if (options.storage) return options.storage;
  try {
    if (typeof window === 'undefined') return null;
    return options.persistence === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function defaultOpenWindow(url: string): boolean {
  // With `noopener` the spec returns null even on success, so only a thrown
  // error counts as failure here; the vectors' `not-handled` case is covered
  // by injecting an opener that returns false.
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function createWebHostHandler(options: WebHostOptions): WebHostHandler {
  const openWindow = options.openWindow ?? defaultOpenWindow;

  const withStorage = <R>(run: (storage: Storage) => R): HostReply<R> => {
    try {
      const storage = resolveStorage(options);
      if (!storage) return fail('STORAGE_UNAVAILABLE', 'Browser storage is not available');
      return { ok: true, result: run(storage) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return fail('STORAGE_UNAVAILABLE', `Browser storage failed: ${reason}`);
    }
  };

  const answer = (method: HostMethod, params: Record<string, unknown>): HostReply<unknown> => {
    switch (method) {
      case 'secureStorage.get':
        return withStorage((storage) => ({ value: storage.getItem(params.key as string) }));
      case 'secureStorage.set':
        return withStorage((storage) => {
          storage.setItem(params.key as string, params.value as string);
          return { stored: true as const };
        });
      case 'secureStorage.delete':
        return withStorage((storage) => {
          storage.removeItem(params.key as string);
          return { deleted: true as const };
        });
      case 'app.info':
        return {
          ok: true,
          result: {
            host: 'web',
            hostBridgeVersion: HOST_BRIDGE_VERSION,
            appVersion: options.appVersion,
            secureStorage: 'browser-storage',
          },
        };
      case 'link.open':
        try {
          return { ok: true, result: { opened: openWindow(params.url as string) } };
        } catch (error) {
          return fail('HOST_ERROR', error instanceof Error ? error.message : String(error));
        }
    }
  };

  return (name, data, moduleName) => {
    // Other modules (custom ones the embedding page registers) are not ours.
    if (moduleName !== 'bridge') return undefined;
    try {
      if (!isHostMethod(name)) return fail('UNKNOWN_METHOD', `Unknown host method "${name}"`);
      const invalid = checkHostParams(name, data);
      if (invalid) return fail(invalid.code, `Invalid ${invalid.field} for ${name}`);
      return answer(name, (data ?? {}) as Record<string, unknown>);
    } catch (error) {
      return fail('HOST_ERROR', error instanceof Error ? error.message : String(error));
    }
  };
}
