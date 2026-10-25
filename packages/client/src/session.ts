/**
 * Session persistence.
 *
 * The session lives in the injected `AsyncKeyValueStore` (the host's secure
 * storage in production, memory in Lynx Explorer) and is mirrored in memory so
 * `current()` is synchronous for render code.
 *
 * Expiry rules differ per backend, deliberately:
 *   - Staff (ahliweb/awcms): opaque bearer, fixed TTL (default 120 min), no
 *     refresh and no sliding window. `expiresAt` is authoritative, so `load()`
 *     drops an expired staff session instead of sending a doomed request.
 *   - Customer (ahliweb/awcms-one): token lifetime is 30 days SLIDING on the
 *     server, and `GET me` does not return a new `expiresAt`. The stored
 *     `expiresAt` goes stale as the customer keeps using the app, so it is
 *     never used to expire a customer session locally; a 401 does that.
 *
 * Corrupt storage (bad JSON, wrong shape) is treated as "signed out" and
 * removed; a throwing store never breaks sign-out.
 */

import type { AsyncKeyValueStore } from './config.ts';

export interface StaffSession {
  kind: 'staff';
  token: string;
  expiresAt: string;
  tenantId: string;
  assuranceLevel: 'aal1' | 'aal2';
}

export interface CustomerAccount {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  level: string | null;
  createdAt: string;
  historyFrom: string | null;
  marketingConsent: boolean;
}

export interface CustomerSession {
  kind: 'customer';
  token: string;
  expiresAt: string;
  account: CustomerAccount;
}

export type Session = StaffSession | CustomerSession;

export interface SessionManager {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
  current(): Session | null;
  subscribe(listener: (session: Session | null) => void): () => void;
}

export const DEFAULT_SESSION_KEY = 'awcms-lynx:session';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Tolerant account parse: required `id` + `name`, everything else defaulted. Null if unusable. */
export function parseCustomerAccount(raw: unknown): CustomerAccount | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  if (id === null || id === '') return null;
  return {
    id,
    name: str(raw.name) ?? '',
    email: str(raw.email),
    phone: str(raw.phone),
    level: str(raw.level),
    createdAt: str(raw.createdAt) ?? '',
    historyFrom: str(raw.historyFrom),
    marketingConsent: raw.marketingConsent === true,
  };
}

function parseSession(raw: unknown): Session | null {
  if (!isRecord(raw)) return null;
  const token = str(raw.token);
  const expiresAt = str(raw.expiresAt);
  if (!token || expiresAt === null) return null;
  if (raw.kind === 'staff') {
    const tenantId = str(raw.tenantId);
    if (!tenantId) return null;
    return {
      kind: 'staff',
      token,
      expiresAt,
      tenantId,
      assuranceLevel: raw.assuranceLevel === 'aal2' ? 'aal2' : 'aal1',
    };
  }
  if (raw.kind === 'customer') {
    const account = parseCustomerAccount(raw.account);
    if (!account) return null;
    return { kind: 'customer', token, expiresAt, account };
  }
  return null;
}

export function createSessionManager(
  store: AsyncKeyValueStore,
  options: { key?: string; now?: () => number } = {},
): SessionManager {
  const key = options.key ?? DEFAULT_SESSION_KEY;
  const now = options.now ?? Date.now;
  let cached: Session | null = null;
  const listeners = new Set<(session: Session | null) => void>();

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener(cached);
      } catch {
        // A faulty subscriber must not break the others or the caller.
      }
    }
  };

  const safeRemove = async () => {
    try {
      await store.removeItem(key);
    } catch {
      // Storage may be unavailable; the in-memory state is already cleared.
    }
  };

  return {
    async load() {
      let stored: Session | null = null;
      try {
        const raw = await store.getItem(key);
        if (raw !== null) {
          try {
            stored = parseSession(JSON.parse(raw));
          } catch {
            stored = null;
          }
          if (stored === null) await safeRemove();
        }
      } catch {
        stored = null;
      }
      if (stored?.kind === 'staff') {
        const expiry = Date.parse(stored.expiresAt);
        if (Number.isNaN(expiry) || expiry <= now()) {
          stored = null;
          await safeRemove();
        }
      }
      cached = stored;
      notify();
      return cached;
    },

    async save(session) {
      cached = session;
      try {
        await store.setItem(key, JSON.stringify(session));
      } finally {
        notify();
      }
    },

    async clear() {
      cached = null;
      await safeRemove();
      notify();
    },

    current() {
      return cached;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
