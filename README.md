🇬🇧 English (source) · 🇮🇩 [Bahasa Indonesia](README.id.md)

# awcms-lynx

The AWCMS family's **LynxJS / ReactLynx client-app template**: one ReactLynx code base, rendered natively on **iOS, Android and HarmonyOS**, in the browser through **Lynx for Web**, and on **macOS and Windows** through **Lynxtron** — all talking to an [`ahliweb/awcms`](https://github.com/ahliweb/awcms) or [`ahliweb/awcms-one`](https://github.com/ahliweb/awcms-one) backend through its documented HTTP API.

It is the "separate persona-app repository" that awcms ADR-0146 and awcms-one ADR-0050 call for: the backends stay free of Lynx, and a derived product starts here instead of from an empty `create-lynx` project ([ADR-0001](docs/adr/0001-awcms-lynx-is-the-persona-app-template-repository.md)).

> **Status:** template foundation. The API client, host contract, shared UI, Lynx and Web bundles, Web host and desktop host build and are tested in CI; the native hosts under `hosts/` are reference sources a derived product compiles in its own proof of concept. [`docs/status.md`](docs/status.md) lists what is verified per target.

## What you get

| Path | What it is |
| --- | --- |
| `packages/client` | `@awcms-lynx/client` — typed HTTP client for both backends: envelope, errors, correlation id, idempotency, tenant header, staff sign-in (password, MFA, workspace selection) and customer one-time-code sessions, money formatting without `Intl`. Runs inside the Lynx background thread. |
| `packages/platform` | `@awcms-lynx/platform` — the host-bridge contract every host implements ([ADR-0003](docs/adr/0003-one-host-bridge-contract-for-every-lynx-host.md)), its background-thread adapter, runtime configuration, and the browser-side host handler. |
| `packages/app` | `@awcms-lynx/app` — the shared ReactLynx application: screens, components, English/Indonesian strings, design tokens, `startApp()`. |
| `apps/mobile` | Rspeedy build of the app: `dist/main.lynx.bundle` (iOS, Android, HarmonyOS, Lynx Explorer) and `dist/main.web.bundle` (Lynx for Web). |
| `apps/web` | The browser page that mounts `<lynx-view>` and answers the host bridge; deploy examples for Caddy and nginx. |
| `apps/desktop` | The Lynxtron host for macOS and Windows. |
| `hosts/` | Reference native hosts — Android (Kotlin), iOS (Swift), HarmonyOS (ArkTS) — implementing the same contract with Keystore, Keychain and HUKS. |
| `docs/` | Architecture, backend integration, security, UI guidelines, testing, deployment, development workflow, ADRs. |

## Two backend profiles

| `PUBLIC_AWCMS_BACKEND` | Backend | Persona | Tabs |
| --- | --- | --- | --- |
| `awcms` | ahliweb/awcms | staff, member, field worker | Home (health + JSON Feed), Search (site search), Account (sign-in, session, sign-out), Settings |
| `awcms-one` (default) | ahliweb/awcms-one | customer | Home (health + storefront news), Catalog (storefront product index), Account (one-time code, orders, sign-out), Settings |

## Quick start

Requirements: [Bun](https://bun.sh) 1.4.4+ **and** [Node.js](https://nodejs.org) 22.18+ (the Lynx toolchain runs under Node — [ADR-0002](docs/adr/0002-bun-workspace-with-node-runtime-for-the-lynx-toolchain.md)).

```bash
bun install
cp .env.example apps/mobile/.env      # point PUBLIC_AWCMS_* at your backend
bun run dev                           # Rspeedy dev server + QR code
```

Scan the QR code with **Lynx Explorer** (Android APK, iOS simulator, HarmonyOS simulator — see the [Lynx quick start](https://lynxjs.org/guide/start/quick-start.html)), or paste the bundle URL into Explorer's "Enter Card URL".

| Target | Develop | Build |
| --- | --- | --- |
| iOS / Android / HarmonyOS (Explorer) | `bun run dev` | `bun run build:mobile` → `apps/mobile/dist/main.lynx.bundle` |
| Web | `bun run build:mobile && bun run dev:web` | `bun run build` → `apps/web/dist/` |
| macOS / Windows | `bun run dev:desktop` | `bun run build:desktop`, then `bun run --cwd apps/desktop pack` |
| Native release app | embed `main.lynx.bundle` in a host from `hosts/` | per [`hosts/README.md`](hosts/README.md) |

Everything a pull request must pass: `bun run check` (lint, type-check, unit tests, UI tests, builds).

## Starting a product from this template

1. **Use this template** on GitHub; the new repository owns its copy completely ([ADR-0001](docs/adr/0001-awcms-lynx-is-the-persona-app-template-repository.md) D4).
2. Choose the backend profile and set `PUBLIC_AWCMS_*` for each environment (`.env.example`).
3. Rename app ids (`id.ahliweb.awcms.lynx`) in `apps/desktop` and the host you adopt from `hosts/`.
4. Run the proof-of-concept gate (awcms-one ADR-0050 D6 / awcms ADR-0146 §5) on every target you will ship, and record the result in your own `docs/status.md`.
5. Raise the backend gaps you hit (native-capable staff auth, refresh, customer push…) as API issues in the backend repository — [`docs/backend-integration.md`](docs/backend-integration.md#gaps).

## Documentation

Start at [`docs/README.md`](docs/README.md). Working rules for people and AI agents: [`AGENTS.md`](AGENTS.md).

## License

[MIT](LICENSE). Portions are adapted from Lynx templates and samples (Apache-2.0) — see [`NOTICE`](NOTICE).
