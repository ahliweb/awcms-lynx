/*
 * Reference implementation — adapt package/bundle ids; derived from
 * lynx-family/integrating-lynx-demo-projects (Apache-2.0) and the Lynx "Native Modules" guide
 * (guide/custom-native-modules/native-module-harmony.mdx: `LynxModule` subclass from `@lynx/lynx`,
 * constructor(context: LynxContext, param?: Object), public methods are the exported methods).
 *
 * AwcmsHostBridge: the single Lynx NativeModule every AWCMS Lynx host registers
 * (packages/platform/src/contract.ts, HOST_BRIDGE_MODULE = 'AwcmsHostBridge').
 *
 *   NativeModules.AwcmsHostBridge.call(method, params, callback)
 *
 * The callback receives ONE argument: the reply as a JSON string,
 * {"ok":true,"result":{...}} or {"ok":false,"error":{"code":"...","message":"..."}}.
 * `parseHostReply` on the JS side accepts a string or an object; a string avoids depending on
 * how the Harmony bridge converts nested objects passed to callbacks.
 *
 * Structure (contract logic is testable without Lynx in a hypium unit test):
 *   SecureStore / LinkOpener  : platform seams
 *   HostBridgeDispatcher      : pure contract logic (validation, error codes, JSON)
 *   AwcmsHostBridgeModule     : thin LynxModule adapter
 * hosts/contract-test-vectors.json is meant to be replayed against HostBridgeDispatcher.
 *
 * Execution model: this is a regular (non-@Sendable) module, so per the guide its methods are
 * asynchronous and return null to JS; replies therefore travel only through the callback.
 * VERIFY: whether making it a @Sendable module is preferable once the PoC measures call latency.
 *
 * Security decisions:
 *   - Every argument is untrusted (`Object | null | undefined`): wrong JS types must yield an error
 *     reply, never an exception out of the module.
 *   - Nothing is logged: keys, values and URLs stay out of hilog.
 *   - Error messages are fixed strings; internal error details are never echoed to JS.
 *   - JSON is assembled from JSON.stringify(<string>) fragments on purpose: ArkTS forbids untyped
 *     object literals, and these replies have fixed, tiny shapes.
 */
import { LynxContext, LynxModule } from '@lynx/lynx';
import { bundleManager, common } from '@kit.AbilityKit';
import { HuksSecureStore, SecureStore } from './HuksSecureStore';

export interface LinkOpener {
  /** Receives an already-validated http(s) URL; resolves false if nothing could handle it. */
  open(url: string): Promise<boolean>;
}

export const MAX_VALUE_LENGTH: number = 16384; // UTF-16 code units, like JS String.length in contract.ts
const MAX_URL_LENGTH: number = 2048;
const HOST_BRIDGE_VERSION: number = 1;

const STORAGE_KEY: RegExp = new RegExp('^awcms-lynx:[a-z0-9:._-]{1,96}$'); // no 'm' flag: `$` = end of input only
const CONTROL_OR_SPACE: RegExp = new RegExp('[\\u0000-\\u0020\\u007f]');
const SCHEME: RegExp = new RegExp('^([A-Za-z][A-Za-z0-9+.-]*):');
const HTTP_URL: RegExp = new RegExp('^https?://[^/?#@\\s]+([/?#].*)?$', 'i');

export class HostBridgeDispatcher {
  private store: SecureStore | null;
  private links: LinkOpener | null;
  private appVersion: string;

  constructor(store: SecureStore | null, links: LinkOpener | null, appVersion: string) {
    this.store = store;
    this.links = links;
    this.appVersion = appVersion;
  }

  /** Always resolves with a JSON string. Never rejects. */
  async dispatch(method: Object | null | undefined, params: Object | null | undefined): Promise<string> {
    try {
      return await this.route(method, params);
    } catch (err) {
      return HostBridgeDispatcher.fail('HOST_ERROR', 'Host failed to handle the call');
    }
  }

  private async route(method: Object | null | undefined, params: Object | null | undefined): Promise<string> {
    const bag: Record<string, Object> = HostBridgeDispatcher.asRecord(params);
    // Anything that is not one of the five known strings is an unknown method (incl. null / non-strings).
    const name: string = typeof method === 'string' ? method : '';

    if (name === 'secureStorage.get') {
      const key: string | null = HostBridgeDispatcher.validKey(bag['key']);
      if (key === null) {
        return HostBridgeDispatcher.invalid('key');
      }
      try {
        const value: string | null = await this.requireStore().get(key);
        return HostBridgeDispatcher.ok('{"value":' + (value === null ? 'null' : JSON.stringify(value)) + '}');
      } catch (err) {
        return HostBridgeDispatcher.storageUnavailable();
      }
    }
    if (name === 'secureStorage.set') {
      const key: string | null = HostBridgeDispatcher.validKey(bag['key']);
      if (key === null) {
        return HostBridgeDispatcher.invalid('key');
      }
      const value: Object | undefined = bag['value'];
      if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) {
        return HostBridgeDispatcher.invalid('value');
      }
      try {
        await this.requireStore().set(key, value);
        return HostBridgeDispatcher.ok('{"stored":true}');
      } catch (err) {
        return HostBridgeDispatcher.storageUnavailable();
      }
    }
    if (name === 'secureStorage.delete') {
      const key: string | null = HostBridgeDispatcher.validKey(bag['key']);
      if (key === null) {
        return HostBridgeDispatcher.invalid('key');
      }
      try {
        await this.requireStore().remove(key); // idempotent
        return HostBridgeDispatcher.ok('{"deleted":true}');
      } catch (err) {
        return HostBridgeDispatcher.storageUnavailable();
      }
    }
    if (name === 'app.info') {
      return HostBridgeDispatcher.ok(
        '{"host":"harmony","hostBridgeVersion":' + HOST_BRIDGE_VERSION.toString() +
          ',"appVersion":' + JSON.stringify(this.appVersion) + ',"secureStorage":"harmony-huks"}'
      );
    }
    if (name === 'link.open') {
      return await this.openLink(bag['url']);
    }
    return HostBridgeDispatcher.fail('UNKNOWN_METHOD', 'Unknown method');
  }

  private async openLink(raw: Object | undefined): Promise<string> {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) {
      return HostBridgeDispatcher.invalid('url');
    }
    // Platform URL parsers strip whitespace/control characters ("java\nscript:"): refuse them first.
    if (CONTROL_OR_SPACE.test(raw)) {
      return HostBridgeDispatcher.invalid('url');
    }
    const match: RegExpExecArray | null = SCHEME.exec(raw);
    if (match === null) {
      return HostBridgeDispatcher.invalid('url');
    }
    const scheme: string = match[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return HostBridgeDispatcher.fail('FORBIDDEN_SCHEME', 'Only http(s) URLs may be opened');
    }
    // Stricter than the JS regexp on purpose: a host is required and userinfo
    // ("https://trusted.example@evil.example") is refused as a phishing vector.
    if (!HTTP_URL.test(raw)) {
      return HostBridgeDispatcher.invalid('url');
    }
    let opened: boolean = false;
    if (this.links !== null) {
      try {
        opened = await this.links.open(raw);
      } catch (err) {
        opened = false;
      }
    }
    return HostBridgeDispatcher.ok('{"opened":' + (opened ? 'true' : 'false') + '}');
  }

  private requireStore(): SecureStore {
    if (this.store === null) {
      throw new Error('no store');
    }
    return this.store;
  }

  private static asRecord(params: Object | null | undefined): Record<string, Object> {
    if (params !== null && params !== undefined && typeof params === 'object' && !Array.isArray(params)) {
      return params as Record<string, Object>;
    }
    return {};
  }

  private static validKey(raw: Object | undefined): string | null {
    return typeof raw === 'string' && STORAGE_KEY.test(raw) ? raw : null;
  }

  private static ok(resultJson: string): string {
    return '{"ok":true,"result":' + resultJson + '}';
  }

  private static invalid(field: string): string {
    return HostBridgeDispatcher.fail('INVALID_PARAMS', 'Invalid ' + field);
  }

  private static storageUnavailable(): string {
    return HostBridgeDispatcher.fail('STORAGE_UNAVAILABLE', 'Secure storage is unavailable');
  }

  private static fail(code: string, message: string): string {
    return '{"ok":false,"error":{"code":' + JSON.stringify(code) + ',"message":' + JSON.stringify(message) + '}}';
  }
}

/**
 * link.open on HarmonyOS. Primary: UIAbilityContext.openLink(url, { appLinkingOnly: false }) —
 * opens a matching App Link, else the default browser. Fallback: startAbility with the browsable
 * "view data" want. VERIFY both on the target API level (Want-based browser launch is the
 * long-standing path; openLink is newer).
 */
export class AbilityLinkOpener implements LinkOpener {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async open(url: string): Promise<boolean> {
    try {
      await this.context.openLink(url, { appLinkingOnly: false });
      return true;
    } catch (err) {
      try {
        await this.context.startAbility({
          action: 'ohos.want.action.viewData',
          entities: ['entity.system.browsable'],
          uri: url,
        });
        return true;
      } catch (fallbackErr) {
        return false;
      }
    }
  }
}

/** Passed as the module `param` at registration (see AwcmsLynxHost.ets): the guide's `param?: Object` slot. */
export class AwcmsModuleParam {
  readonly abilityContext: common.UIAbilityContext;

  constructor(abilityContext: common.UIAbilityContext) {
    this.abilityContext = abilityContext;
  }
}

export class AwcmsHostBridgeModule extends LynxModule {
  private dispatcher: HostBridgeDispatcher;

  constructor(context: LynxContext, param?: Object) {
    super(context, param);
    let store: SecureStore | null = null;
    let links: LinkOpener | null = null;
    if (param instanceof AwcmsModuleParam) {
      try {
        store = new HuksSecureStore(param.abilityContext);
      } catch (err) {
        store = null; // every secureStorage.* call then answers STORAGE_UNAVAILABLE
      }
      links = new AbilityLinkOpener(param.abilityContext);
    }
    this.dispatcher = new HostBridgeDispatcher(store, links, AwcmsHostBridgeModule.versionName());
  }

  /**
   * The single exported method. Public methods of a LynxModule subclass are exported by name
   * (native-module-harmony.mdx). Types follow the guide's mapping table (object -> object,
   * string -> string, function -> function).
   * VERIFY: that a wrong JS argument type reaches us (or is rejected by Lynx) without terminating the ability.
   */
  public call(method: Object | null | undefined, params: Object | null | undefined,
    callback: (reply: string) => void): void {
    this.dispatcher.dispatch(method, params).then((reply: string): void => {
      this.safeReply(callback, reply);
    });
  }

  private safeReply(callback: (reply: string) => void, reply: string): void {
    try {
      callback(reply);
    } catch (err) {
      // The LynxView may have been destroyed while we worked; nothing useful to do.
    }
  }

  private static versionName(): string {
    try {
      return bundleManager.getBundleInfoForSelfSync(bundleManager.BundleFlag.GET_BUNDLE_INFO_DEFAULT).versionName;
    } catch (err) {
      return '0.0.0';
    }
  }
}
