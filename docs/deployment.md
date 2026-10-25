# Deployment

One source, six shippable targets. Each target is a **host** plus the bundle it loads; the backend is deployed separately by the derived product (ADR-0001 D2). Build the bundles first: `bun run build:mobile` → `apps/mobile/dist/main.lynx.bundle`, `apps/mobile/dist/main.web.bundle`.

## Configuration per environment

`PUBLIC_AWCMS_*` (`.env.example`) is inlined at build time; hosts may override the same keys at runtime through Lynx `globalProps`. Typical setup: one bundle per environment (development, staging, production) built with `.env.<mode>`, or one bundle with the host passing `apiBaseUrl` for the environment. No secret ever goes into either.

## Targets

| Target | Host | Artifact | Steps | Detail |
| --- | --- | --- | --- | --- |
| Android | `hosts/android` (Kotlin, LynxView) | APK / AAB with `main.lynx.bundle` in assets | adopt the host into an Android project created from `lynx-family/integrating-lynx-demo-projects`, copy the bundle into `assets/`, sign, upload to Play | [`hosts/android/README.md`](../hosts/android/README.md) |
| iOS | `hosts/ios` (Swift, LynxView via CocoaPods) | IPA with the bundle as a resource | same, from the Swift demo project; signing, App Store Connect | [`hosts/ios/README.md`](../hosts/ios/README.md) |
| HarmonyOS | `hosts/harmony` (ArkTS) | HAP with the bundle in `rawfile` | same, from the Harmony demo project; DevEco signing, AppGallery | [`hosts/harmony/README.md`](../hosts/harmony/README.md) |
| Web | `apps/web` (`<lynx-view>`) | `apps/web/dist/` static files | `bun run build`; serve behind a reverse proxy that forwards `/api` and `/feed.json` to the backend, with the CSP and headers in `apps/web/deploy/` | [`apps/web/README.md`](../apps/web/README.md) |
| macOS | `apps/desktop` (Lynxtron) | `.dmg` / `.zip` | `bun run build:desktop`, `bun run --cwd apps/desktop pack` on a Mac; Developer ID signing + notarisation | [`apps/desktop/README.md`](../apps/desktop/README.md) |
| Windows | `apps/desktop` (Lynxtron) | NSIS installer | same on Windows; Authenticode signing | [`apps/desktop/README.md`](../apps/desktop/README.md) |
| Development on a phone | Lynx Explorer | dev-server URL | `bun run dev`, scan the QR code | [Lynx quick start](https://lynxjs.org/guide/start/quick-start.html) |

Lynx Explorer is a sandbox for development only: it has no `AwcmsHostBridge`, so sessions live in memory and the Settings screen says so.

## Web specifics

- **Same origin.** awcms staff routes have no CORS; awcms-one commerce routes accept only registered tenant domains. Serve the web app on the origin you configure as `PUBLIC_AWCMS_API_BASE_URL` and proxy `/api/*` and `/feed.json` to the backend (`apps/web/deploy/Caddyfile.example`, `nginx.conf.example`).
- **CSP.** Lynx for Web needs `'unsafe-eval'`, `blob:` and one `sha256-` hash tied to `@lynx-js/web-core` 0.26.5; recompute the hash when web-core is upgraded. If the storefront index lives on another origin, add it to `connect-src`.
- **Caching.** `static/**` is content-hashed (`immutable`); `index.html` and `*.bundle` have stable names (`no-cache`).
- **SEO.** The app shell sends `noindex, nofollow`: persona apps are not search surfaces, public SEO stays on the Astro sites (awcms ADR-0146).

## Backend prerequisites

| Profile | The backend must… |
| --- | --- |
| `awcms` | expose `/api/v1` over https; for native sign-in, run login without Turnstile (LAN/offline profile) or provide a native-capable auth design (`docs/backend-integration.md` §Gaps) |
| `awcms-one` | resolve the tenant for requests without `Origin` (`PUBLIC_TENANT_RESOLUTION_MODE=host_default` or `PUBLIC_DEFAULT_TENANT_ID`), or the app sets `originHeader`; serve the storefront static index for the catalog; register the web app's domain as a tenant domain if it is not served same-origin |

## Release checklist (per product)

- [ ] App ids, names and icons replaced (`id.ahliweb.awcms.lynx` placeholders).
- [ ] Production `PUBLIC_AWCMS_API_BASE_URL` is https; cleartext/ATS exceptions only in debug builds.
- [ ] PoC results recorded per target in the product's `docs/status.md` (build, secure storage, sign-in/out, accessibility with screen readers, low-end device performance, offline behaviour).
- [ ] Signing configured; release builds load only the packaged bundle (no dev-server URL).
- [ ] `bun run check` green; version tagged from the changesets.
