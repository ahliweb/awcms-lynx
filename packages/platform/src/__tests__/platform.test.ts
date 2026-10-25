import { describe, expect, test } from 'bun:test';
import { createHostBridge, createMemoryHostBridge, createSecureKeyValueStore } from '../bridge.ts';
import { HOST_BRIDGE_MODULE, parseHostReply, validateHostParams } from '../contract.ts';
import { normaliseBaseUrl, RuntimeConfigError, resolveRuntimeConfig } from '../runtime-config.ts';

describe('parseHostReply', () => {
  test('accepts an object and its JSON string identically', () => {
    const reply = { ok: true as const, result: { value: 'x' } };
    expect(parseHostReply(reply)).toEqual(reply);
    expect(parseHostReply(JSON.stringify(reply))).toEqual(reply);
  });
  test('turns garbage into a HOST_ERROR instead of throwing', () => {
    expect(parseHostReply('not json')).toMatchObject({ ok: false, error: { code: 'HOST_ERROR' } });
    expect(parseHostReply(undefined)).toMatchObject({ ok: false });
  });
});

describe('validateHostParams', () => {
  test('restricts storage keys to the awcms-lynx namespace', () => {
    expect(validateHostParams('secureStorage.get', { key: 'awcms-lynx:session' })).toBeNull();
    expect(validateHostParams('secureStorage.get', { key: 'other:session' })).toBe('key');
    expect(validateHostParams('secureStorage.set', { key: 'awcms-lynx:s', value: 1 })).toBe(
      'value',
    );
  });
  test('link.open only allows http(s)', () => {
    expect(validateHostParams('link.open', { url: 'https://example.id' })).toBeNull();
    expect(validateHostParams('link.open', { url: 'javascript:alert(1)' })).toBe('url');
    expect(validateHostParams('link.open', { url: 'file:///etc/passwd' })).toBe('url');
  });
});

describe('createHostBridge', () => {
  test('falls back to memory when no host module exists (Lynx Explorer)', async () => {
    const bridge = createHostBridge({ nativeModules: {} });
    expect(bridge.transport).toBe('memory');
    expect((await bridge.invoke('app.info', {})).secureStorage).toBe('memory');
  });

  test('prefers the custom native module over the built-in bridge', async () => {
    const calls: string[] = [];
    const nativeModules = {
      [HOST_BRIDGE_MODULE]: {
        call: (method: string, _p: object, cb: (r: unknown) => void) => {
          calls.push(`native:${method}`);
          cb(JSON.stringify({ ok: true, result: { value: 'from-native' } }));
        },
      },
      bridge: { call: () => calls.push('builtin') },
    };
    const bridge = createHostBridge({ nativeModules });
    expect(bridge.transport).toBe('native-module');
    expect(await bridge.invoke('secureStorage.get', { key: 'awcms-lynx:k' })).toEqual({
      value: 'from-native',
    });
    expect(calls).toEqual(['native:secureStorage.get']);
  });

  test('uses the built-in bridge on Web/Lynxtron and surfaces host errors', async () => {
    const nativeModules = {
      bridge: {
        call: (_m: string, _p: object, cb: (r: unknown) => void) =>
          cb({ ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'nope' } }),
      },
    };
    const bridge = createHostBridge({ nativeModules });
    expect(bridge.transport).toBe('lynx-bridge');
    await expect(bridge.invoke('secureStorage.get', { key: 'awcms-lynx:k' })).rejects.toMatchObject(
      {
        code: 'STORAGE_UNAVAILABLE',
      },
    );
  });

  test('rejects invalid params before reaching the host', async () => {
    let reached = false;
    const bridge = createHostBridge({
      nativeModules: { bridge: { call: () => (reached = true) } },
    });
    await expect(bridge.invoke('link.open', { url: 'intent://x' })).rejects.toMatchObject({
      code: 'FORBIDDEN_SCHEME',
    });
    await expect(bridge.invoke('link.open', { url: 'https://a@b.example' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
    expect(reached).toBe(false);
  });

  test('times out a host that never answers', async () => {
    const bridge = createHostBridge({
      nativeModules: { bridge: { call: () => {} } },
      timeoutMs: 20,
    });
    await expect(bridge.invoke('app.info', {})).rejects.toMatchObject({ code: 'HOST_TIMEOUT' });
  });
});

test('createSecureKeyValueStore round-trips through the bridge', async () => {
  const kv = createSecureKeyValueStore(createMemoryHostBridge());
  await kv.setItem('awcms-lynx:session', 'token');
  expect(await kv.getItem('awcms-lynx:session')).toBe('token');
  await kv.removeItem('awcms-lynx:session');
  expect(await kv.getItem('awcms-lynx:session')).toBeNull();
});

describe('runtime config', () => {
  test('globalProps override build-time defaults field by field', () => {
    const config = resolveRuntimeConfig(
      { backend: 'awcms-one', apiBaseUrl: 'https://cms.example.id/', locale: 'id' },
      { apiBaseUrl: 'https://staging-cms.example.id' },
    );
    expect(config).toMatchObject({
      backend: 'awcms-one',
      apiBaseUrl: 'https://staging-cms.example.id',
      locale: 'id',
      tenantId: null,
      storefrontOrigin: null,
    });
  });
  test('refuses plain http outside loopback/LAN, credentials and junk', () => {
    expect(normaliseBaseUrl('http://192.168.1.20:4321', 'apiBaseUrl')).toBe(
      'http://192.168.1.20:4321',
    );
    expect(normaliseBaseUrl('http://10.0.2.2:4321/', 'apiBaseUrl')).toBe('http://10.0.2.2:4321');
    expect(() => normaliseBaseUrl('http://cms.example.id', 'apiBaseUrl')).toThrow(
      RuntimeConfigError,
    );
    expect(() => normaliseBaseUrl('https://u:p@cms.example.id', 'apiBaseUrl')).toThrow(
      /credentials/,
    );
    expect(() => normaliseBaseUrl('https://cms.example.id/?x=1', 'apiBaseUrl')).toThrow(/query/);
    expect(() => normaliseBaseUrl('ftp://cms.example.id', 'apiBaseUrl')).toThrow(
      RuntimeConfigError,
    );
  });
  test('validates backend and tenant id', () => {
    expect(() =>
      resolveRuntimeConfig({ backend: 'wordpress', apiBaseUrl: 'https://a.id' }),
    ).toThrow(/backend/);
    expect(() => resolveRuntimeConfig({ apiBaseUrl: 'https://a.id', tenantId: 'acme' })).toThrow(
      /UUID/,
    );
    expect(() => resolveRuntimeConfig({})).toThrow(/apiBaseUrl/);
  });
});
