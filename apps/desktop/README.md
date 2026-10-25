# @awcms-lynx/desktop

The **Lynxtron** host: macOS and Windows desktop app. One `LynxWindow` runs
`main.lynx.bundle`, built from the same `@awcms-lynx/app` code as every other
host (no UI code lives here), and the Node main process answers the
[host-bridge contract](../../packages/platform/src/contract.ts).

The browser build is [`apps/web`](../web); this package has no web target on purpose.

## Requirements

- macOS (arm64 or x64) or Windows (x64) to **run and package** the app.
- Node `^22.18 || ^24 || ^26` (Lynxtron's requirement) and Bun >= 1.4.4 at the repo root.
- Lynxtron runs on Linux x64 only headless (`windowless: true`), which this host does not
  use: no Linux desktop target.

## Commands

Run from the repo root (`bun install` first), or `cd apps/desktop`:

| Command | What it does |
| --- | --- |
| `bun run --cwd apps/desktop dev` | `rspeedy dev` (UI on :5969, hot reload) + `rsbuild dev` (main process, restarts Lynxtron on change) |
| `bun run --cwd apps/desktop build` | `rspeedy build` (UI bundle) + `rsbuild build` (main process) into `dist/desktop/` |
| `bun run --cwd apps/desktop start` | build, then run `dist/desktop` with the Lynxtron runtime |
| `bun run --cwd apps/desktop pack` | build, then package with `lynxtron-builder`: `.dmg` + `.zip` (macOS), NSIS installer (Windows), output in `dist/` |
| `bun run --cwd apps/desktop typecheck` | `tsc` for the config files, the main process and the UI entry |

Configuration is by `PUBLIC_AWCMS_*` variables (see `.env.example`): they are inlined into the
UI bundle (`src/app/build-env.ts`) and the main process at build time. `apiBaseUrl` can point
straight at the backend: a desktop app is not a browser, so the CORS limits that shape
`apps/web` do not apply.

### Lifecycle scripts (Bun)

Bun skips dependency `postinstall` scripts unless they are trusted. Two matter here:

- `@lynx-js/lynxtron` downloads the runtime. Not needed: the CLI extracts the installed
  runtime package on first use (verified).
- `@lynx-js/lynxtron-builder` patches `electron-builder` for Lynxtron (`patch.js`, via
  `patch-package`). **Needed for `pack`, and deliberately not trusted in the root
  `package.json`:** `patch-package` looks for `app-builder-lib` and `dmg-builder` at the root
  `node_modules/`, which Bun's default isolated linker does not create, so trusting it makes
  `bun install` fail (observed in CI on PR #1: "Patch file found for package app-builder-lib
  which is not present at node_modules/app-builder-lib"). To package, on the macOS or Windows
  build machine: `bun install --linker hoisted`, then `bun pm trust @lynx-js/lynxtron-builder`,
  then `bun run --cwd apps/desktop pack`. This path is **not verified** here (see below); do not
  commit the resulting `trustedDependencies` change.

## How it works

```
src/app/index.tsx      startApp(BUILD_DEFAULTS) from @awcms-lynx/app   -> output/bundle/lynx/main.lynx.bundle
src/main/main.ts       LynxWindow + `-lynx-invoke` -> host.ts           -> dist/desktop/main.js
src/main/host.ts       the five contract methods (pure, unit-tested)
src/main/secret-store.ts  JSON file under the per-user data dir (pure Node, unit-tested)
src/main/host-config.ts   globalProps + window title from build-time values
```

### Host-bridge methods

`NativeModules.bridge.call(method, params, cb)` in the UI arrives in the main process as
`window.on('-lynx-invoke', (event, method, params))`; `event.sendReply(reply)` returns the
reply object (`{ ok: true, result } | { ok: false, error }`). The handler reuses `isHostMethod`,
`validateHostParams` and `HOST_BRIDGE_VERSION` from `@awcms-lynx/platform/contract`, so key
patterns, value limits and error codes are identical on every host.

| Method | Desktop behaviour |
| --- | --- |
| `secureStorage.get / set / delete` | entries in `<userData>/secure-storage.json` (see below) |
| `app.info` | `{ host: 'desktop', hostBridgeVersion, appVersion, secureStorage: 'app-file' }` |
| `link.open` | `shell.openExternal` after re-parsing the URL: only `http:`/`https:`, no embedded credentials, else `FORBIDDEN_SCHEME` |

### Secure storage: what Lynxtron 0.0.30 offers, and what this does

Checked in `node_modules/@lynx-js/lynxtron/apis`:

- **No `safeStorage` / OS keyring API.** There is nothing equivalent to Electron's
  `safeStorage.encryptString`, so the host cannot report `os-keyring`.
- `globalProps` **is** supported: `LynxWindow.loadFile / loadURL / loadBundle(…, { globalProps })`
  and `setGlobalProps`. It is wired (`host-config.ts`) with the same build-time values as the UI
  bundle. There is no runtime override file or environment variable on purpose: a
  user-writable setting must not be able to repoint a signed staff app at another server.
- `shell.openExternal` exists and is used.
- `LynxPreference` has only `preload`.

So `secureStorage` is a file in `app.getPath('userData')` (`~/Library/Application Support/id.ahliweb.awcms.lynx/`
on macOS, `%APPDATA%\id.ahliweb.awcms.lynx\` on Windows), created with mode `0o600` in a `0o700`
directory, written atomically, capped at 256 entries, and reported as `secureStorage: 'app-file'`.
It is **not encrypted at rest**: any process running as the same user can read it. The app shows
the label and does not call the session "secure". A derived app that must do better should
add an OS-keyring native module (macOS Keychain / Windows Credential Manager) through Lynxtron's
AutoLink native-package mechanism and report `os-keyring`.

### Least privilege: no preload

The Lynxtron scaffold registers a preload that exposes Node functions to the UI
(`contextBridge.exposeInLynxBTS`, surfaced as `NativeModules.nodejs`). This host registers
**none**: the UI's only channel out is `NativeModules.bridge.call`, restricted to the five
validated methods above, and an unknown method name (including the scaffold's `showDialog`) gets
`UNKNOWN_METHOD`. If a derived app adds a preload, expose single-purpose functions, never `fs`,
`child_process` or `shell`. The main process also takes a single-instance lock (two instances
would race on the secret file).

## Packaging and signing

`electron-builder.yml` has the `appId` (`id.ahliweb.awcms.lynx`) and `productName` (`AWCMS Lynx`)
placeholders; **change both** in a derived app, and keep `productName` in step with
`PUBLIC_AWCMS_APP_NAME`. `resources/` holds the Lynxtron placeholder icons from the official
scaffold (Apache-2.0, see its notice): replace `lynxtron.icns`, `lynxtron.ico` and `lynxtron.png` with your own (and update `icon:` in the yml).

Not done in this template (TODO for the derived app, none of it can run in CI without your
credentials):

- **macOS**: sign with a *Developer ID Application* certificate and notarise
  (`mac.identity`, `hardenedRuntime`, `notarize`, entitlements). Unsigned builds
  (`identity: null` here) are blocked by Gatekeeper on other Macs.
- **Windows**: Authenticode signing (EV certificate or Azure Trusted Signing) so SmartScreen
  does not warn.
- **Fuses**: harden the packaged runtime with `lynxtron-fuses write runAsNode=off
  nodeOptions=off embeddedAsarIntegrityValidation=on onlyLoadAppFromAsar=on` (see the
  `@lynx-js/lynxtron` README) and test the result.
- Auto-update and the release pipeline (`--publish never` is used).
- Static assets imported into the Lynx UI: the scaffold bakes an absolute `assetPrefix` into
  the bundle; this template leaves it at the default. If the UI ever bundles local images,
  verify they resolve from the packaged `app.asar`.

## Verification status

Verified in a Linux sandbox: install, `rspeedy build` + `rsbuild build`, typecheck, unit tests,
and a headless Lynxtron run (`windowless: true` on a copy of `dist/desktop`; the real runtime
loaded `main.lynx.bundle` and answered `app.info` / `secureStorage.get` through this host; only GPU
output failed, there is no EGL display). **Not verified**: a windowed run on macOS/Windows,
`dev`, and `pack` (needs macOS/Windows toolchains).
