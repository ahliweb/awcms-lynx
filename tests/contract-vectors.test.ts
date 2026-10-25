/**
 * Replays hosts/contract-test-vectors.json — the specification the native
 * Android, iOS and HarmonyOS hosts are written against — against the two JS
 * hosts this repository builds and runs: the browser page (apps/web via
 * packages/platform/src/web-host.ts) and the Lynxtron main process
 * (apps/desktop/src/main/host.ts). If a JS host and the vectors disagree, one
 * of them is wrong for every platform, so the vectors are fixed first.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDesktopHostHandler } from '../apps/desktop/src/main/host.ts';
import { createWebHostHandler } from '../packages/platform/src/web-host.ts';

interface Step {
  request: { method?: unknown; params?: unknown };
  expect: unknown;
}
interface Case {
  id: string;
  steps?: Step[];
  request?: Step['request'];
  expect?: unknown;
  linkOpener?: { returns: boolean };
  expectOpenedUrls?: string[];
}

const vectors = JSON.parse(
  readFileSync(join(import.meta.dir, '../hosts/contract-test-vectors.json'), 'utf8'),
) as {
  cases: Case[];
};

/** Expands `{ $repeat: { prefix, text, count } }` anywhere in a value. */
function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const repeat = record.$repeat as { prefix: string; text: string; count: number } | undefined;
    if (repeat) return repeat.prefix + repeat.text.repeat(repeat.count);
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, expand(v)]));
  }
  return value;
}

/** Subset match with the vector matchers; `error.message` is never compared. */
function matches(
  actual: unknown,
  expected: unknown,
  platform: { host: string; secureStorage: string },
  path = '',
): string | null {
  if (expected === '$string')
    return typeof actual === 'string' && actual.length > 0 ? null : `${path}: not a string`;
  if (expected === '$platform.host')
    return actual === platform.host ? null : `${path}: ${String(actual)}`;
  if (expected === '$platform.secureStorage')
    return actual === platform.secureStorage ? null : `${path}: ${String(actual)}`;
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (!actual || typeof actual !== 'object') return `${path}: expected object`;
    for (const [key, value] of Object.entries(expected)) {
      if (path.endsWith('error') && key === 'message') continue;
      const problem = matches(
        (actual as Record<string, unknown>)[key],
        value,
        platform,
        `${path}.${key}`,
      );
      if (problem) return problem;
    }
    return null;
  }
  return JSON.stringify(actual) === JSON.stringify(expected)
    ? null
    : `${path}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`;
}

type Invoke = (method: unknown, params: unknown) => Promise<unknown>;
interface HostUnderTest {
  name: string;
  platform: { host: string; secureStorage: string };
  make: (opener: { returns: boolean; opened: string[] }) => Invoke;
  normaliseUrl: (url: string) => string;
}

class MemoryStorage {
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

const hosts: HostUnderTest[] = [
  {
    name: 'web (packages/platform/src/web-host.ts)',
    platform: { host: 'web', secureStorage: 'browser-storage' },
    make: (opener) => {
      const handler = createWebHostHandler({
        storage: new MemoryStorage() as unknown as Storage,
        appVersion: '0.1.0',
        openWindow: (url) => {
          opener.opened.push(url);
          return opener.returns;
        },
      });
      return async (method, params) => handler(method as string, params, 'bridge');
    },
    normaliseUrl: (url) => url,
  },
  {
    name: 'desktop (apps/desktop/src/main/host.ts)',
    platform: { host: 'desktop', secureStorage: 'app-file' },
    make: (opener) => {
      const data = new Map<string, string>();
      const handler = createDesktopHostHandler({
        store: {
          get: (key) => data.get(key) ?? null,
          set: (key, value) => void data.set(key, value),
          delete: (key) => void data.delete(key),
        },
        appVersion: '0.1.0',
        openExternal: async (url) => {
          opener.opened.push(url);
          return opener.returns;
        },
      });
      return (method, params) => handler(method as string, params);
    },
    // The desktop host hands the OS a parsed, normalised href (trailing slash,
    // lower-case scheme/host) — the vectors allow that normalisation.
    normaliseUrl: (url) => new URL(url).href,
  },
];

for (const host of hosts) {
  describe(`contract vectors → ${host.name}`, () => {
    for (const vector of vectors.cases) {
      test(vector.id, async () => {
        const opener = { returns: vector.linkOpener?.returns ?? true, opened: [] as string[] };
        const invoke = host.make(opener);
        const steps = vector.steps ?? [{ request: vector.request ?? {}, expect: vector.expect }];
        for (const [index, step] of steps.entries()) {
          const params = 'params' in step.request ? expand(step.request.params) : undefined;
          const reply = await invoke(step.request.method, params);
          const problem = matches(reply, expand(step.expect), host.platform, `step ${index}`);
          expect({ id: vector.id, problem }).toEqual({ id: vector.id, problem: null });
        }
        const expectedUrls = vector.linkOpener ? (vector.expectOpenedUrls ?? []) : [];
        expect(opener.opened.map(host.normaliseUrl)).toEqual(expectedUrls.map(host.normaliseUrl));
      });
    }
  });
}
