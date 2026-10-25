/**
 * Rsbuild config for the Lynx for Web host page.
 *
 *   build    copies the already-built main.web.bundle (apps/mobile/dist) next
 *            to the host page; it fails when that bundle does not exist.
 *   dev      serves apps/mobile/dist as-is (or proxies it from a running
 *            `rspeedy dev`, see AWCMS_DEV_BUNDLE_ORIGIN) and proxies /api and
 *            /feed.json to the AWCMS backend so the browser stays same-origin.
 *   preview  like dev, plus the production security headers below.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from '@rsbuild/core';
import { renderHtmlShell, safeThemeColor } from './html-template.ts';
import { resolveHtmlLang } from './src/host-config.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8')) as {
  version: string;
};

const { parsed, publicVars } = loadEnv({ prefixes: ['PUBLIC_'] });
const setting = (name: string): string | undefined => {
  const raw = process.env[name] ?? parsed[name];
  return raw?.trim() ? raw.trim() : undefined;
};

const bundleDir = path.resolve(here, setting('AWCMS_WEB_BUNDLE_DIR') ?? '../mobile/dist');
const proxyTarget = setting('AWCMS_DEV_PROXY_TARGET') ?? 'http://localhost:4321';
const bundleOrigin = setting('AWCMS_DEV_BUNDLE_ORIGIN');

const appName = setting('PUBLIC_AWCMS_APP_NAME') ?? 'AWCMS Lynx';
const lang = resolveHtmlLang(setting('PUBLIC_AWCMS_LOCALE'));
const themeColor = safeThemeColor(setting('PUBLIC_AWCMS_THEME_COLOR'));

// Rsbuild only takes a template *path*, so the shell (html-template.ts) is rendered
// into node_modules/.cache, which neither git nor biome looks at.
const htmlTemplatePath = path.join(here, 'node_modules/.cache/awcms-lynx-web/index.html');
mkdirSync(path.dirname(htmlTemplatePath), { recursive: true });
writeFileSync(htmlTemplatePath, renderHtmlShell({ lang, appName, themeColor }));

function origin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * The one inline script web-core 0.26.5 puts into the sandboxed iframe it runs
 * the main-thread script in (dist/client/mainthread/createIFrameRealm.js).
 * A CSP hash allows exactly this script without 'unsafe-inline'. Re-check the
 * text (and this hash) whenever @lynx-js/web-core is upgraded.
 */
const MTS_READY_SCRIPT = 'parent.postMessage("lynx:mtsready","*")';
const MTS_READY_HASH = `'sha256-${createHash('sha256').update(MTS_READY_SCRIPT).digest('base64')}'`;

/**
 * Content-Security-Policy for the built page, verified in Chromium against
 * main.web.bundle (each source below was removed in turn; the app failed
 * without it unless noted). Keep deploy/Caddyfile.example and
 * deploy/nginx.conf.example in sync with this list.
 *
 *  - script-src 'unsafe-eval':  web-core's background worker builds the app's
 *                               JS with `new Function`. Only same-origin /
 *                               blob: bundle code is ever evaluated.
 *  - script-src blob:           web-core loads decoded bundle chunks from blob: URLs.
 *  - script-src <hash>:         the iframe bootstrap script above.
 *  - script-src 'wasm-unsafe-eval': web-core compiles WebAssembly; implied by
 *                               'unsafe-eval' today, listed so dropping
 *                               'unsafe-eval' later is a one-line change.
 *  - style-src 'unsafe-inline' + blob: Lynx writes element styles inline and
 *                               attaches a blob: stylesheet in the shadow root.
 *  - connect-src blob:          web-core reads the blob: chunks with XHR.
 *  - worker-src 'self':         web-core's workers are same-origin modules.
 */
function contentSecurityPolicy(): string {
  const connect = new Set(["'self'", 'blob:']);
  for (const name of ['PUBLIC_AWCMS_API_BASE_URL', 'PUBLIC_AWCMS_STOREFRONT_ORIGIN']) {
    const o = origin(setting(name));
    if (o) connect.add(o);
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob: ${MTS_READY_HASH}`,
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline' blob:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `connect-src ${[...connect].join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export default defineConfig(({ command }) => {
  const hasBundle = existsSync(path.join(bundleDir, 'main.web.bundle'));
  if (command === 'build' && !hasBundle) {
    throw new Error(
      `main.web.bundle not found in ${bundleDir}. Run "bun run build:mobile" first ` +
        '(or set AWCMS_WEB_BUNDLE_DIR to the directory that holds it).',
    );
  }
  if (command !== 'build' && !hasBundle && !bundleOrigin) {
    console.warn(
      `[awcms-lynx/web] ${path.join(bundleDir, 'main.web.bundle')} does not exist yet: ` +
        'run "bun run build:mobile", or "bun run --cwd apps/mobile dev" together with ' +
        'AWCMS_DEV_BUNDLE_ORIGIN=http://localhost:3000.',
    );
  }

  const apiProxy = {
    target: proxyTarget,
    changeOrigin: true,
  };

  return {
    source: {
      entry: { index: './src/index.ts' },
      define: {
        ...publicVars,
        __APP_VERSION__: JSON.stringify(pkg.version),
      },
    },
    html: {
      template: htmlTemplatePath,
    },
    output: {
      target: 'web',
      distPath: { root: 'dist' },
      // web-core ships its WebAssembly renderer as `.wasm` files and workers
      // as modules; the defaults hash and place them under static/.
      copy: [
        {
          from: bundleDir,
          to: '.',
          // The native bundle is for the iOS/Android/HarmonyOS/desktop hosts.
          globOptions: { ignore: ['**/*.lynx.bundle', '**/.DS_Store'] },
          noErrorOnMissing: true,
        },
      ],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Dev only: serve the mobile dist directly so a fresh `build:mobile` shows up
      // on reload without copying. Production output is copied by output.copy.
      publicDir:
        command === 'dev' && !bundleOrigin && hasBundle
          ? { name: bundleDir, copyOnBuild: false, watch: true }
          : false,
      headers:
        command === 'preview'
          ? {
              'Content-Security-Policy': contentSecurityPolicy(),
              'X-Content-Type-Options': 'nosniff',
              'Referrer-Policy': 'strict-origin-when-cross-origin',
              'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
              'Cache-Control': 'no-cache',
            }
          : undefined,
      proxy: [
        // awcms staff routes send no CORS headers, so the browser must reach the
        // backend through the page's own origin.
        { pathFilter: ['/api', '/feed.json'], ...apiProxy },
        ...(bundleOrigin && command === 'dev'
          ? [
              {
                pathFilter: (pathname: string) =>
                  pathname.endsWith('.bundle') ||
                  pathname.endsWith('.map') ||
                  pathname.startsWith('/static/'),
                target: bundleOrigin,
                changeOrigin: true,
              },
            ]
          : []),
      ],
    },
  };
});
