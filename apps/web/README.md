# @awcms-lynx/web

The **Lynx for Web** host: a static page that mounts one full-viewport `<lynx-view>` on
`main.web.bundle` (built by [`apps/mobile`](../mobile) from the shared `@awcms-lynx/app`
code) and answers the host-bridge contract in the browser. No UI code lives here.

```
apps/mobile  --rspeedy build-->  dist/main.web.bundle  --copied into-->  apps/web/dist/
                                                                         index.html + static/ (web-core, wasm)
```

## Commands

From the repo root:

```bash
bun install
bun run build:mobile          # produces apps/mobile/dist/main.web.bundle (required first)
bun run build:web             # apps/web/dist: index.html, main.web.bundle, static/**
bun run dev:web               # http://localhost:3000, proxies /api and /feed.json
bun run --cwd apps/web preview   # serves dist/ with the production security headers
bun run --cwd apps/web typecheck
```

`build` fails clearly when the bundle is missing: *"main.web.bundle not found … Run
"bun run build:mobile" first"*.

### Dev server

`rsbuild dev` serves `apps/mobile/dist` as-is (rebuild the mobile app and reload). To get hot
reload of UI edits instead, run `bun run --cwd apps/mobile dev` and start the web host with
`AWCMS_DEV_BUNDLE_ORIGIN=http://localhost:<port>` (the port `rspeedy dev` prints; both tools
default to 3000, so pass `--port` to one of them): `*.bundle`, `*.map` and `/static/*` are then
proxied from rspeedy. Either way `/api/*` and `/feed.json` are proxied to
`AWCMS_DEV_PROXY_TARGET` (default `http://localhost:4321`).

## Why the browser must call the backend same-origin

awcms **staff routes send no CORS headers**: there is no `OPTIONS` handler, and
`Authorization` / `X-AWCMS-Tenant-ID` are never allowed cross-origin. A browser page on another
origin therefore cannot call them, no matter what the page does. The web host is designed
around this:

- `apiBaseUrl` (and, for the customer backend, `storefrontOrigin`) **default to the page's own
  origin** (`window.location.origin`), so the app talks to `https://app.example.id/api/...`.
- A reverse proxy in front of the static files forwards `/api/*` and `/feed.json` to the
  backend (`bun run dev` does this for development; production examples below).
- In production leave `PUBLIC_AWCMS_API_BASE_URL` empty, or set it to the web app's own
  origin. Setting it to another origin only works for endpoints that answer CORS (e.g. the
  public awcms-one catalog) and needs that origin in the CSP `connect-src`.

The dev proxy rewrites `Host` to the target (`changeOrigin`). If your backend routes tenants by
domain, set `PUBLIC_AWCMS_TENANT_ID` instead, or use the production proxies, which keep the public
`Host`.

## Configuration

`PUBLIC_AWCMS_*` values are inlined at build time (see `.env.example`) and are visible to every
visitor: never put a secret in one. They become the `<lynx-view>` `globalProps`
(`backend`, `apiBaseUrl`, `storefrontOrigin`, `tenantId`, `locale`, `appName`); only defined,
non-empty values are passed, so the bundle's own defaults still apply to the rest.

| Variable | Effect |
| --- | --- |
| `PUBLIC_AWCMS_BACKEND` | `awcms` or `awcms-one` |
| `PUBLIC_AWCMS_API_BASE_URL` | default: the page origin |
| `PUBLIC_AWCMS_STOREFRONT_ORIGIN` | awcms-one catalog origin, default: the page origin |
| `PUBLIC_AWCMS_TENANT_ID` | tenant UUID (awcms) |
| `PUBLIC_AWCMS_LOCALE` | `id` (default) / `en`; also `<html lang>` |
| `PUBLIC_AWCMS_APP_NAME` | `<title>`, `<meta description>`, app title |
| `PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE` | `local` / `session`; default `session` for `awcms` (staff), `local` otherwise |

Ordering in `src/index.ts`: `globalProps` and `onNativeModulesCall` are set **before** `url`, and
the element is appended last. web-core caches handler calls made before the assignment, but the
config must be in place when the bundle starts.

## Host bridge on the web

`createWebHostHandler` (`@awcms-lynx/platform/web-host`) is assigned to
`lynxView.onNativeModulesCall`. `secureStorage` is the browser's `sessionStorage` or
`localStorage`, so `app.info` reports `secureStorage: 'browser-storage'`: any script on the origin
can read it, and the app does not call the session "secure". Staff sessions default to
`sessionStorage` (dropped with the tab). `link.open` uses
`window.open(url, '_blank', 'noopener,noreferrer')` for `http(s)` URLs only.

First paint note: ReactLynx renders the first screen on the main thread, where `NativeModules` does
not exist yet; the bridge (`lynx-bridge`) is only available once the background thread runs.
Create the bridge lazily from background-only code (effects/handlers), not during render.

## Deploying

Build, copy `dist/` to the web root, and put a reverse proxy in front:

- [`deploy/Caddyfile.example`](deploy/Caddyfile.example)
- [`deploy/nginx.conf.example`](deploy/nginx.conf.example)

Both: serve static files, forward `/api/*` and `/feed.json` to the backend, send the security
headers, `Cache-Control: public, max-age=31536000, immutable` on content-hashed `static/**`, and
`no-cache` on `index.html` and `*.bundle` (stable names). Neither example was run against a real
Caddy or nginx here (neither is installed in the build sandbox): test them in your environment.

### Content-Security-Policy

Derived by running the built page under CSP in Chromium and removing each source in turn
(`rsbuild.config.ts`, `contentSecurityPolicy()`, also sent by `preview`):

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob: 'sha256-jRMGyyS9ZQKlh3Jf5wqkvDxFe4RAk7bBflr8m7gc9nc=';
worker-src 'self'; style-src 'self' 'unsafe-inline' blob:; img-src 'self' data: blob: https:;
font-src 'self' data:; connect-src 'self' blob:; object-src 'none'; base-uri 'none';
form-action 'self'; frame-ancestors 'none'
```

| Source | Why web-core needs it |
| --- | --- |
| `'unsafe-eval'` | the background worker builds the app JS with `new Function` |
| `blob:` (script, connect) | decoded bundle chunks are loaded from `blob:` URLs |
| `'sha256-…'` | the one inline `parent.postMessage("lynx:mtsready","*")` bootstrap script in the sandboxed iframe web-core runs the main thread in |
| `'wasm-unsafe-eval'` | the WebAssembly renderer (implied by `'unsafe-eval'` today) |
| `style-src 'unsafe-inline' blob:` | Lynx writes inline element styles and a `blob:` stylesheet in the shadow root |

`'unsafe-eval'` is a real cost: the CSP cannot stop injected script from evaluating strings. It
is the price of running the Lynx engine in a browser today. The hash is tied to
`@lynx-js/web-core@0.26.5`: recompute it (command in the examples) whenever web-core is upgraded.
`Strict-Transport-Security` belongs on the HTTPS listener only; the examples include it.

## Not verified here

Safari and Firefox (only Chromium was run), real Caddy/nginx, and a backend behind the proxy
(`/api` proxying was checked in dev with a stub server).
