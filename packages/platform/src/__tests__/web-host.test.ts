import { describe, expect, test } from 'bun:test';
import { HOST_BRIDGE_VERSION, HOST_METHODS } from '../contract.ts';
import { createWebHostHandler, type WebHostOptions } from '../web-host.ts';

class FakeStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

class ThrowingStorage extends FakeStorage {
  override getItem(): string | null {
    throw new DOMException('denied', 'SecurityError');
  }
  override setItem(): void {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  }
  override removeItem(): void {
    throw new Error('boom');
  }
}

const KEY = 'awcms-lynx:session';

function make(overrides: Partial<WebHostOptions> = {}) {
  const opened: string[] = [];
  const storage = new FakeStorage();
  const handler = createWebHostHandler({
    storage,
    appVersion: '1.2.3',
    openWindow: (url) => {
      opened.push(url);
      return true;
    },
    ...overrides,
  });
  return { handler, storage, opened };
}

describe('createWebHostHandler', () => {
  test('ignores modules other than bridge', () => {
    const { handler } = make();
    expect(handler('app.info', {}, 'CustomModule')).toBeUndefined();
  });

  test('stores, reads and deletes a value', () => {
    const { handler, storage } = make();
    expect(handler('secureStorage.get', { key: KEY }, 'bridge')).toEqual({
      ok: true,
      result: { value: null },
    });
    expect(handler('secureStorage.set', { key: KEY, value: 'tok' }, 'bridge')).toEqual({
      ok: true,
      result: { stored: true },
    });
    expect(storage.getItem(KEY)).toBe('tok');
    expect(handler('secureStorage.get', { key: KEY }, 'bridge')).toEqual({
      ok: true,
      result: { value: 'tok' },
    });
    expect(handler('secureStorage.delete', { key: KEY }, 'bridge')).toEqual({
      ok: true,
      result: { deleted: true },
    });
    expect(storage.getItem(KEY)).toBeNull();
  });

  test('rejects keys outside the namespace and oversize values', () => {
    const { handler, storage } = make();
    for (const key of ['session', 'awcms-lynx:UPPER', 'awcms-lynx:', 42, undefined]) {
      expect(handler('secureStorage.set', { key, value: 'x' }, 'bridge')).toMatchObject({
        ok: false,
        error: { code: 'INVALID_PARAMS' },
      });
    }
    expect(
      handler('secureStorage.set', { key: KEY, value: 'x'.repeat(16_385) }, 'bridge'),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PARAMS' } });
    expect(handler('secureStorage.set', { key: KEY, value: 5 }, 'bridge')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    expect(storage.length).toBe(0);
  });

  test('unknown method and prototype-ish names are UNKNOWN_METHOD', () => {
    const { handler } = make();
    for (const name of ['nope', 'toString', '__proto__', '']) {
      expect(handler(name, {}, 'bridge')).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_METHOD' },
      });
    }
  });

  test('tolerates missing or non-object params', () => {
    const { handler } = make();
    expect(handler('app.info', undefined, 'bridge')).toMatchObject({ ok: true });
    expect(handler('secureStorage.get', null, 'bridge')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    expect(handler('secureStorage.get', 'string', 'bridge')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
  });

  test('app.info reports the web host and browser-storage honestly', () => {
    const { handler } = make();
    expect(handler('app.info', {}, 'bridge')).toEqual({
      ok: true,
      result: {
        host: 'web',
        hostBridgeVersion: HOST_BRIDGE_VERSION,
        appVersion: '1.2.3',
        secureStorage: 'browser-storage',
      },
    });
  });

  test('link.open only opens http(s) URLs', () => {
    const { handler, opened } = make();
    expect(handler('link.open', { url: 'https://example.id/a?b=1' }, 'bridge')).toEqual({
      ok: true,
      result: { opened: true },
    });
    expect(handler('link.open', { url: 'HTTP://localhost:4321' }, 'bridge')).toMatchObject({
      ok: true,
    });
    expect(opened).toEqual(['https://example.id/a?b=1', 'HTTP://localhost:4321']);
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'ftp://x',
    ]) {
      expect(handler('link.open', { url }, 'bridge')).toMatchObject({
        ok: false,
        error: { code: 'FORBIDDEN_SCHEME' },
      });
    }
    // Not a URL with a scheme at all, per hosts/contract-test-vectors.json.
    expect(handler('link.open', { url: '//evil.com' }, 'bridge')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    expect(handler('link.open', { url: 5 }, 'bridge')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARAMS' },
    });
    expect(opened).toHaveLength(2);
  });

  test('link.open reports HOST_ERROR when the window cannot open', () => {
    const { handler } = make({
      openWindow: () => {
        throw new Error('popup blocked');
      },
    });
    expect(handler('link.open', { url: 'https://example.id' }, 'bridge')).toEqual({
      ok: false,
      error: { code: 'HOST_ERROR', message: 'popup blocked' },
    });
  });

  test('storage exceptions become STORAGE_UNAVAILABLE and never throw', () => {
    const handler = createWebHostHandler({ storage: new ThrowingStorage(), appVersion: '1' });
    for (const [name, params] of [
      ['secureStorage.get', { key: KEY }],
      ['secureStorage.set', { key: KEY, value: 'x' }],
      ['secureStorage.delete', { key: KEY }],
    ] as const) {
      expect(handler(name, params, 'bridge')).toMatchObject({
        ok: false,
        error: { code: 'STORAGE_UNAVAILABLE' },
      });
    }
  });

  test('without a window and without storage, storage calls report STORAGE_UNAVAILABLE', () => {
    // bun test has no DOM, so the default lookup finds no window.
    const handler = createWebHostHandler({ appVersion: '1' });
    expect(handler('secureStorage.get', { key: KEY }, 'bridge')).toMatchObject({
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
    expect(handler('app.info', {}, 'bridge')).toMatchObject({ ok: true });
  });

  test('answers every method in the contract', () => {
    const { handler } = make();
    const params = {
      'secureStorage.get': { key: KEY },
      'secureStorage.set': { key: KEY, value: 'v' },
      'secureStorage.delete': { key: KEY },
      'app.info': {},
      'link.open': { url: 'https://example.id' },
    } as const;
    for (const method of HOST_METHODS) {
      expect(handler(method, params[method], 'bridge')).toMatchObject({ ok: true });
    }
  });
});
