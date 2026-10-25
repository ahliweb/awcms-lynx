import { describe, expect, test } from 'bun:test';
import { HOST_BRIDGE_VERSION, HOST_METHODS } from '@awcms-lynx/platform/contract';
import { createDesktopHostHandler, type DesktopStore, parseExternalUrl } from '../host.ts';

const KEY = 'awcms-lynx:session';

function memoryStore(): DesktopStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    delete: (key) => void data.delete(key),
  };
}

function make(overrides: Partial<Parameters<typeof createDesktopHostHandler>[0]> = {}) {
  const store = memoryStore();
  const opened: string[] = [];
  const handler = createDesktopHostHandler({
    store,
    appVersion: '9.9.9',
    openExternal: async (url) => {
      opened.push(url);
      return true;
    },
    ...overrides,
  });
  return { handler, store, opened };
}

describe('createDesktopHostHandler', () => {
  test('stores, reads and deletes a value', async () => {
    const { handler, store } = make();
    expect(await handler('secureStorage.get', { key: KEY })).toEqual({
      ok: true,
      result: { value: null },
    });
    expect(await handler('secureStorage.set', { key: KEY, value: 'tok' })).toEqual({
      ok: true,
      result: { stored: true },
    });
    expect(store.data.get(KEY)).toBe('tok');
    expect(await handler('secureStorage.get', { key: KEY })).toEqual({
      ok: true,
      result: { value: 'tok' },
    });
    expect(await handler('secureStorage.delete', { key: KEY })).toEqual({
      ok: true,
      result: { deleted: true },
    });
    expect(store.data.size).toBe(0);
  });

  test('validates keys, values and method names like every other host', async () => {
    const { handler } = make();
    expect(await handler('secureStorage.set', { key: '../etc/passwd', value: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    expect(
      await handler('secureStorage.set', { key: KEY, value: 'x'.repeat(16_385) }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PARAMS' } });
    expect(await handler('secureStorage.get', undefined)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    for (const name of ['nope', 'toString', '__proto__', 'showDialog', 'getAppVersion']) {
      expect(await handler(name, {})).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_METHOD' },
      });
    }
  });

  test('app.info reports the desktop host and the honest storage backend', async () => {
    const { handler } = make();
    expect(await handler('app.info', {})).toEqual({
      ok: true,
      result: {
        host: 'desktop',
        hostBridgeVersion: HOST_BRIDGE_VERSION,
        appVersion: '9.9.9',
        secureStorage: 'app-file',
      },
    });
  });

  test('link.open hands only normalised http(s) URLs to the OS', async () => {
    const { handler, opened } = make();
    expect(await handler('link.open', { url: 'https://example.id' })).toEqual({
      ok: true,
      result: { opened: true },
    });
    expect(opened).toEqual(['https://example.id/']);
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'ms-msdt:/id']) {
      expect(await handler('link.open', { url })).toMatchObject({
        ok: false,
        error: { code: 'FORBIDDEN_SCHEME' },
      });
    }
    // Malformed http(s) is INVALID_PARAMS, per hosts/contract-test-vectors.json.
    for (const url of [
      'ms-msdt:/id x',
      'https://user:pw@example.id',
      'https://exa mple.id',
      'http://',
    ]) {
      expect(await handler('link.open', { url })).toMatchObject({
        ok: false,
        error: { code: 'INVALID_PARAMS' },
      });
    }
    expect(await handler('link.open', { url: 42 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    expect(opened).toHaveLength(1);
  });

  test('a failing store or opener becomes an error reply, never an exception', async () => {
    const { handler } = make({
      store: {
        get: () => {
          throw new Error('disk full');
        },
        set: () => {
          throw new Error('disk full');
        },
        delete: () => {
          throw new Error('disk full');
        },
      },
      openExternal: async () => {
        throw new Error('no browser');
      },
    });
    expect(await handler('secureStorage.get', { key: KEY })).toMatchObject({
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE', message: 'disk full' },
    });
    expect(await handler('secureStorage.set', { key: KEY, value: 'v' })).toMatchObject({
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
    expect(await handler('link.open', { url: 'https://example.id' })).toEqual({
      ok: false,
      error: { code: 'HOST_ERROR', message: 'no browser' },
    });
  });

  test('answers every method in the contract', async () => {
    const { handler } = make();
    const params = {
      'secureStorage.get': { key: KEY },
      'secureStorage.set': { key: KEY, value: 'v' },
      'secureStorage.delete': { key: KEY },
      'app.info': {},
      'link.open': { url: 'https://example.id' },
    } as const;
    for (const method of HOST_METHODS) {
      expect(await handler(method, params[method])).toMatchObject({ ok: true });
    }
  });
});

describe('parseExternalUrl', () => {
  test('accepts http(s), rejects the rest', () => {
    expect(parseExternalUrl('http://localhost:4321/a?b=1')).toBe('http://localhost:4321/a?b=1');
    expect(parseExternalUrl('mailto:a@b.id')).toBeNull();
    expect(parseExternalUrl('not a url')).toBeNull();
  });
});
