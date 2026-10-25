import { describe, expect, test } from 'bun:test';
import { createSessionManager, type Session } from '../session.ts';
import { ACCOUNT, MemoryStore, TENANT } from './testkit.ts';

const NOW = Date.parse('2026-06-01T12:00:00Z');
const now = () => NOW;

const staff = (expiresAt: string): Session => ({
  kind: 'staff',
  token: 'tok',
  expiresAt,
  tenantId: TENANT,
  assuranceLevel: 'aal1',
});

describe('session manager', () => {
  test('save persists and current() reflects it; clear removes both', async () => {
    const store = new MemoryStore();
    const sessions = createSessionManager(store, { now });
    expect(sessions.current()).toBeNull();
    const s = staff('2026-06-01T14:00:00Z');
    await sessions.save(s);
    expect(sessions.current()).toEqual(s);
    expect(store.data.has('awcms-lynx:session')).toBe(true);
    await sessions.clear();
    expect(sessions.current()).toBeNull();
    expect(store.data.size).toBe(0);
  });

  test('load restores a valid staff session', async () => {
    const store = new MemoryStore();
    const s = staff('2026-06-01T14:00:00Z');
    await createSessionManager(store, { now }).save(s);
    const fresh = createSessionManager(store, { now });
    expect(await fresh.load()).toEqual(s);
    expect(fresh.current()).toEqual(s);
  });

  test('load drops an expired staff session (expiresAt <= now) and removes it from storage', async () => {
    for (const expiresAt of ['2026-06-01T12:00:00Z', '2026-06-01T11:59:59Z']) {
      const store = new MemoryStore();
      await createSessionManager(store, { now }).save(staff(expiresAt));
      const fresh = createSessionManager(store, { now });
      expect(await fresh.load()).toBeNull();
      expect(store.data.size).toBe(0);
    }
  });

  test('load drops a staff session with an unparsable expiresAt', async () => {
    const store = new MemoryStore();
    await createSessionManager(store, { now }).save(staff('not a date'));
    expect(await createSessionManager(store, { now }).load()).toBeNull();
  });

  test('load keeps a customer session regardless of expiresAt (sliding server-side)', async () => {
    const store = new MemoryStore();
    const s: Session = {
      kind: 'customer',
      token: 'cs_x',
      expiresAt: '2020-01-01T00:00:00Z',
      account: ACCOUNT,
    };
    await createSessionManager(store, { now }).save(s);
    expect(await createSessionManager(store, { now }).load()).toEqual(s);
  });

  test('corrupt JSON and wrong shapes are dropped and cleaned up', async () => {
    for (const raw of [
      '{not json',
      'null',
      '[]',
      '{"kind":"staff","token":"t"}',
      '{"kind":"customer","token":"t","expiresAt":"x"}',
      '{"kind":"alien","token":"t","expiresAt":"x"}',
    ]) {
      const store = new MemoryStore();
      store.data.set('awcms-lynx:session', raw);
      const sessions = createSessionManager(store, { now });
      expect(await sessions.load()).toBeNull();
      expect(store.data.size).toBe(0);
    }
  });

  test('a throwing store never breaks load or clear', async () => {
    const broken = {
      getItem: async () => {
        throw new Error('keychain locked');
      },
      setItem: async () => {},
      removeItem: async () => {
        throw new Error('keychain locked');
      },
    };
    const sessions = createSessionManager(broken, { now });
    expect(await sessions.load()).toBeNull();
    await sessions.clear();
    expect(sessions.current()).toBeNull();
  });

  test('custom storage key', async () => {
    const store = new MemoryStore();
    await createSessionManager(store, { key: 'custom', now }).save(staff('2026-06-01T14:00:00Z'));
    expect([...store.data.keys()]).toEqual(['custom']);
  });

  test('subscribe notifies on save, clear and load; unsubscribe stops it', async () => {
    const store = new MemoryStore();
    const sessions = createSessionManager(store, { now });
    const seen: Array<Session | null> = [];
    const off = sessions.subscribe((s) => seen.push(s));
    const s = staff('2026-06-01T14:00:00Z');
    await sessions.save(s);
    await sessions.clear();
    await sessions.load();
    expect(seen).toEqual([s, null, null]);
    off();
    await sessions.save(s);
    expect(seen).toHaveLength(3);
  });

  test('a throwing listener does not stop others or the caller', async () => {
    const sessions = createSessionManager(new MemoryStore(), { now });
    const seen: unknown[] = [];
    sessions.subscribe(() => {
      throw new Error('boom');
    });
    sessions.subscribe((s) => seen.push(s));
    await sessions.clear();
    expect(seen).toEqual([null]);
  });
});
