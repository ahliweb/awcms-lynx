/**
 * Repository policy gates. Each test pins a rule from AGENTS.md whose breach
 * would be invisible until a device or a reviewer hit it.
 */
import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '..');

function walk(dir: string, filter: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'output' || name.startsWith('.'))
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, filter));
    else if (filter(path)) out.push(path);
  }
  return out;
}

const read = (path: string) => readFileSync(path, 'utf8');
const rel = (path: string) => relative(ROOT, path);
const isSource = (path: string) => /\.(ts|tsx)$/.test(path) && !path.includes('__tests__');

describe('background-thread code uses only what Lynx provides (AGENTS.md rule 3)', () => {
  // Code that runs in the Lynx background thread. web-host.ts runs on the
  // browser page, not in Lynx, so it may use DOM APIs.
  const files = [
    ...walk(join(ROOT, 'packages/client/src'), isSource),
    ...walk(join(ROOT, 'packages/app/src'), isSource),
    ...['bridge.ts', 'contract.ts', 'runtime-config.ts'].map((f) =>
      join(ROOT, 'packages/platform/src', f),
    ),
  ];
  const forbidden: [RegExp, string][] = [
    [/\bnew URL\(/, 'URL'],
    [/\bURLSearchParams\b/, 'URLSearchParams'],
    [/\bIntl\./, 'Intl'],
    [/\bBuffer\./, 'Buffer'],
    [/\blocalStorage\b|\bsessionStorage\b/, 'Web Storage'],
    [/\bcrypto\.randomUUID\b/, 'crypto.randomUUID'],
    [/\bdocument\.|\bwindow\./, 'DOM'],
    [/from 'node:/, 'Node built-ins'],
  ];
  for (const file of files) {
    test(rel(file), () => {
      const text = read(file)
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n');
      for (const [pattern, name] of forbidden) {
        expect({ file: rel(file), uses: pattern.test(text) ? name : null }).toEqual({
          file: rel(file),
          uses: null,
        });
      }
    });
  }
});

test('screens never call fetch or NativeModules directly (rule 2 and 4)', () => {
  for (const file of walk(join(ROOT, 'packages/app/src'), isSource)) {
    const text = read(file);
    expect({
      file: rel(file),
      fetch: /\bfetch\(/.test(text),
      native: /\bNativeModules\b/.test(text),
    }).toEqual({
      file: rel(file),
      fetch: false,
      native: false,
    });
  }
});

test('generic helpers avoid `<T>(…) =>` arrows the ReactLynx test transform rejects (rule 8)', () => {
  // Everything the ReactLynx transform compiles; web-host.ts is bundled for
  // the browser page by Rsbuild and is not affected.
  const files = [
    ...walk(join(ROOT, 'packages/client/src'), isSource),
    ...walk(join(ROOT, 'packages/platform/src'), isSource).filter(
      (f) => !f.endsWith('web-host.ts'),
    ),
    ...walk(join(ROOT, 'packages/app/src'), isSource),
  ];
  for (const file of files) {
    expect({
      file: rel(file),
      arrow: /(=|\(|,)\s*(async\s+)?<[A-Z]\w*>\s*\(/.test(read(file)),
    }).toEqual({
      file: rel(file),
      arrow: false,
    });
  }
});

describe('no secrets in configuration (rule 1)', () => {
  test('.env.example declares no secret-looking variable with a value', () => {
    for (const line of read(join(ROOT, '.env.example')).split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (!match) continue;
      const [, name = '', value = ''] = match;
      if (/TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE|CREDENTIAL/.test(name)) {
        expect({ name, value }).toEqual({ name, value: '' });
      }
    }
  });
  test('no machine credential, customer token or private key is committed', () => {
    const files = walk(
      ROOT,
      (p) =>
        /\.(ts|tsx|json|md|kt|swift|ets|yml|yaml|toml|example)$/.test(p) && !p.endsWith('bun.lock'),
    );
    for (const file of files) {
      const text = read(file);
      expect({
        file: rel(file),
        machine: /awcmsm_[0-9a-f]{32}_[A-Za-z0-9_-]{43}/.test(text),
      }).toEqual({
        file: rel(file),
        machine: false,
      });
      expect({ file: rel(file), pem: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(text) }).toEqual(
        {
          file: rel(file),
          pem: false,
        },
      );
    }
  });
});

test('the client package depends on nothing (it must run in every host)', () => {
  const manifest = JSON.parse(read(join(ROOT, 'packages/client/package.json'))) as Record<
    string,
    unknown
  >;
  expect(manifest.dependencies ?? {}).toEqual({});
});

test('host contract version and methods are mirrored in the native test vectors', async () => {
  const { HOST_BRIDGE_VERSION, HOST_METHODS } = await import(
    '../packages/platform/src/contract.ts'
  );
  const vectors = JSON.parse(read(join(ROOT, 'hosts/contract-test-vectors.json'))) as {
    contractVersion: number;
    cases: { steps?: { request: { method: unknown } }[]; request?: { method: unknown } }[];
  };
  expect(vectors.contractVersion).toBe(HOST_BRIDGE_VERSION);
  const exercised = new Set(
    vectors.cases
      .flatMap((c) => (c.steps ?? [c]).map((s) => s.request?.method))
      .filter((m) => typeof m === 'string'),
  );
  for (const method of HOST_METHODS) expect(exercised.has(method)).toBe(true);
});

describe('documentation', () => {
  test('every ADR is listed in docs/adr/README.md', () => {
    const index = read(join(ROOT, 'docs/adr/README.md'));
    for (const file of readdirSync(join(ROOT, 'docs/adr')).filter(
      (f) => /^\d{4}-.*\.md$/.test(f) && !f.endsWith('.id.md'),
    )) {
      expect({ file, listed: index.includes(file) }).toEqual({ file, listed: true });
    }
  });

  test('English governance and docs pages ship an Indonesian mirror', () => {
    const english = [
      ...['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md'].map((f) => join(ROOT, f)),
      ...walk(join(ROOT, 'docs'), (p) => p.endsWith('.md') && !p.endsWith('.id.md')),
    ];
    for (const file of english) {
      const mirror = file.replace(/\.md$/, '.id.md');
      expect({ file: rel(file), mirror: existsSync(mirror) }).toEqual({
        file: rel(file),
        mirror: true,
      });
    }
  });

  test('relative links in Markdown resolve', () => {
    const files = walk(ROOT, (p) => p.endsWith('.md'));
    for (const file of files) {
      for (const [, target = ''] of read(file).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^(https?:|mailto:)/.test(target)) continue;
        const resolved = join(file, '..', decodeURIComponent(target));
        expect({ file: rel(file), target, exists: existsSync(resolved) }).toEqual({
          file: rel(file),
          target,
          exists: true,
        });
      }
    }
  });
});
