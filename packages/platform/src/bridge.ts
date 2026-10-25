/**
 * Background-thread adapter for the host-bridge contract.
 *
 * Lookup order, chosen so the same bundle runs everywhere:
 *
 *   1. `NativeModules.AwcmsHostBridge.call` — registered by the native iOS,
 *      Android and HarmonyOS hosts (hosts/README.md).
 *   2. `NativeModules.bridge.call` — the built-in bridge that `<lynx-view>`
 *      forwards to `onNativeModulesCall` on the Web and that Lynxtron forwards
 *      to its main process as `-lynx-invoke`.
 *   3. An in-memory fallback — Lynx Explorer and unit tests have neither, so
 *      the app still runs, and `app.info` says `secureStorage: 'memory'` so no
 *      screen pretends a session survived a restart.
 */
import {
  checkHostParams,
  HOST_BRIDGE_MODULE,
  HOST_BRIDGE_VERSION,
  type HostMethod,
  type HostMethodMap,
  type HostReply,
  parseHostReply,
} from './contract.ts';

type RawCall = (method: string, params: object, callback: (reply: unknown) => void) => void;

export interface HostBridge {
  /** Which transport answered: decides nothing at runtime, shown for diagnostics. */
  readonly transport: 'native-module' | 'lynx-bridge' | 'memory';
  invoke<M extends HostMethod>(
    method: M,
    params: HostMethodMap[M]['params'],
  ): Promise<HostMethodMap[M]['result']>;
}

export class HostBridgeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'HostBridgeError';
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

function pickRawCall(
  nativeModules: unknown,
): { call: RawCall; transport: HostBridge['transport'] } | null {
  if (!nativeModules || typeof nativeModules !== 'object') return null;
  const modules = nativeModules as Record<string, { call?: unknown } | undefined>;
  const custom = modules[HOST_BRIDGE_MODULE];
  if (custom && typeof custom.call === 'function') {
    return { call: custom.call.bind(custom) as RawCall, transport: 'native-module' };
  }
  const builtin = modules.bridge;
  if (builtin && typeof builtin.call === 'function') {
    return { call: builtin.call.bind(builtin) as RawCall, transport: 'lynx-bridge' };
  }
  return null;
}

export function createMemoryHostBridge(appVersion = '0.0.0'): HostBridge {
  const store = new Map<string, string>();
  const answer = (method: HostMethod, params: Record<string, unknown>): unknown => {
    switch (method) {
      case 'secureStorage.get':
        return { value: store.get(params.key as string) ?? null };
      case 'secureStorage.set':
        store.set(params.key as string, params.value as string);
        return { stored: true };
      case 'secureStorage.delete':
        store.delete(params.key as string);
        return { deleted: true };
      case 'app.info':
        return {
          host: 'explorer',
          hostBridgeVersion: HOST_BRIDGE_VERSION,
          appVersion,
          secureStorage: 'memory',
        };
      case 'link.open':
        return { opened: false };
    }
  };
  return {
    transport: 'memory',
    async invoke(method, params) {
      const invalid = checkHostParams(method, params);
      if (invalid)
        throw new HostBridgeError(invalid.code, `Invalid ${invalid.field} for ${method}`);
      return answer(method, params as Record<string, unknown>) as never;
    },
  };
}

export interface CreateHostBridgeOptions {
  /** Defaults to the global `NativeModules` Lynx injects into the background thread. */
  nativeModules?: unknown;
  timeoutMs?: number;
  appVersion?: string;
}

export function createHostBridge(options: CreateHostBridgeOptions = {}): HostBridge {
  const nativeModules =
    options.nativeModules ??
    (typeof NativeModules === 'undefined' ? undefined : (NativeModules as unknown));
  const picked = pickRawCall(nativeModules);
  if (!picked) return createMemoryHostBridge(options.appVersion);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    transport: picked.transport,
    invoke(method, params) {
      const invalid = checkHostParams(method, params);
      if (invalid) {
        return Promise.reject(
          new HostBridgeError(invalid.code, `Invalid ${invalid.field} for ${method}`),
        );
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new HostBridgeError('HOST_TIMEOUT', `${method} got no reply in ${timeoutMs} ms`));
        }, timeoutMs);
        try {
          picked.call(method, params, (raw) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const reply = parseHostReply(raw) as HostReply<HostMethodMap[typeof method]['result']>;
            if (reply.ok) resolve(reply.result);
            else reject(new HostBridgeError(reply.error.code, reply.error.message));
          });
        } catch (error) {
          settled = true;
          clearTimeout(timer);
          reject(
            new HostBridgeError(
              'HOST_ERROR',
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      });
    },
  };
}

/**
 * A string key-value store over `secureStorage`, shaped like the
 * `AsyncKeyValueStore` the API client persists sessions into.
 */
export function createSecureKeyValueStore(bridge: HostBridge) {
  return {
    async getItem(key: string): Promise<string | null> {
      return (await bridge.invoke('secureStorage.get', { key })).value;
    },
    async setItem(key: string, value: string): Promise<void> {
      await bridge.invoke('secureStorage.set', { key, value });
    },
    async removeItem(key: string): Promise<void> {
      await bridge.invoke('secureStorage.delete', { key });
    },
  };
}
