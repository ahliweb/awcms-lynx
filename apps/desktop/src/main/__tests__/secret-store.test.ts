import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FileSecretStore, MAX_ENTRIES, SecretStoreError } from '../secret-store.ts';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'awcms-lynx-store-'));
  file = path.join(dir, 'nested', 'secure-storage.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('FileSecretStore', () => {
  test('round-trips values and survives a restart', () => {
    const store = new FileSecretStore(file);
    expect(store.get('awcms-lynx:a')).toBeNull();
    store.set('awcms-lynx:a', 'one');
    store.set('awcms-lynx:b', 'two');
    expect(store.get('awcms-lynx:a')).toBe('one');

    const reopened = new FileSecretStore(file);
    expect(reopened.get('awcms-lynx:b')).toBe('two');
    reopened.delete('awcms-lynx:a');
    expect(new FileSecretStore(file).get('awcms-lynx:a')).toBeNull();
    expect(() => reopened.delete('awcms-lynx:never-there')).not.toThrow();
  });

  test.skipIf(process.platform === 'win32')('creates owner-only file and directory', () => {
    new FileSecretStore(file).set('awcms-lynx:a', 'one');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
  });

  test('leaves no temp file behind', () => {
    new FileSecretStore(file).set('awcms-lynx:a', 'one');
    const leftovers = Bun.spawnSync(['ls', path.dirname(file)])
      .stdout.toString()
      .trim()
      .split('\n');
    expect(leftovers).toEqual(['secure-storage.json']);
  });

  test('a corrupt file is set aside and the store starts empty', () => {
    new FileSecretStore(file).set('awcms-lynx:a', 'one');
    writeFileSync(file, '{"entries": {"awcms-lynx:a": "tr');
    const store = new FileSecretStore(file);
    expect(store.get('awcms-lynx:a')).toBeNull();
    expect(existsSync(`${file}.corrupt`)).toBe(true);
    store.set('awcms-lynx:b', 'two');
    expect(JSON.parse(readFileSync(file, 'utf8')).entries).toEqual({ 'awcms-lynx:b': 'two' });
  });

  test('ignores non-string entries from a hand-edited file', () => {
    new FileSecretStore(file).set('awcms-lynx:a', 'one');
    writeFileSync(file, JSON.stringify({ entries: { 'awcms-lynx:a': 5, 'awcms-lynx:b': 'ok' } }));
    const store = new FileSecretStore(file);
    expect(store.get('awcms-lynx:a')).toBeNull();
    expect(store.get('awcms-lynx:b')).toBe('ok');
  });

  test('caps the number of entries but still allows overwrites', () => {
    const store = new FileSecretStore(file);
    for (let i = 0; i < MAX_ENTRIES; i++) store.set(`awcms-lynx:k${i}`, 'v');
    expect(() => store.set('awcms-lynx:overflow', 'v')).toThrow(SecretStoreError);
    store.set('awcms-lynx:k0', 'changed');
    expect(store.get('awcms-lynx:k0')).toBe('changed');
  });

  test('a write failure throws SecretStoreError and keeps the previous value', () => {
    const store = new FileSecretStore(file);
    store.set('awcms-lynx:a', 'one');
    rmSync(path.dirname(file), { recursive: true, force: true });
    writeFileSync(path.dirname(file), 'a file where the directory should be');
    expect(() => store.set('awcms-lynx:a', 'two')).toThrow(SecretStoreError);
    expect(store.get('awcms-lynx:a')).toBe('one');
  });
});
