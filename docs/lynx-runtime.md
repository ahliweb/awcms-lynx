# The Lynx runtime, as this repository uses it

Facts about Lynx that shape the code, with where they were verified. Lynx engine 4.0 (Explorer release 4.0.0), `@lynx-js/react` 0.129.0, `@lynx-js/rspeedy` 0.18.3, `@lynx-js/web-core` 0.26.5, Lynxtron 0.0.30.

| Fact | Consequence here | Verified in |
| --- | --- | --- |
| UI renders on the main thread; effects, event handlers and `fetch` run on the background thread | client and bridge code is background-thread code | lynx-website `docs/en/react/thinking-in-reactlynx.mdx` |
| Background-thread globals: `fetch`/`Request`/`Response`/`Headers`, `setTimeout`/`setInterval`, `queueMicrotask`, `TextEncoder`/`TextDecoder`, `console`, `SystemInfo`, `NativeModules`, `lynx` | no `URL`, `URLSearchParams`, `AbortController` (feature-detected), `crypto` (feature-detected), `Intl`, `localStorage` | `@lynx-js/types` 4.3.0 `types/background-thread/*.d.ts` |
| Lynx `fetch` on native has no CORS, no redirect/keepalive, no FormData/Blob | native calls need no CORS; uploads need another path | lynx-website `docs/en/api/lynx-api/global/fetch.mdx` |
| On the Web, `fetch` is the browser's | CORS applies to Lynx for Web | same |
| `SystemInfo.platform` ∈ `Android`, `iOS`, `Harmony`, `windows`, `macOS` | host kind comes from `app.info`, not from guessing | `@lynx-js/types` `common/system-info.d.ts` |
| `lynx.__globalProps` carries host-provided values; typed by augmenting `GlobalProps` | runtime config overrides (`apps/mobile/src/env.d.ts`) | `background-thread/lynx.d.ts` |
| `<lynx-view>` exposes `globalProps`, `onNativeModulesCall(name, data, moduleName)`, `nativeModulesMap`, `url` | `apps/web` wiring | `@lynx-js/web-core` `dist/client/mainthread/LynxView.d.ts` |
| Lynxtron forwards `NativeModules.bridge.call` to the main process as `-lynx-invoke` | `apps/desktop` main process answers the contract | `create-lynxtron` 0.0.30 template |
| Rspeedy `environments: { lynx: {}, web: {} }` emits `main.lynx.bundle` and `main.web.bundle` | one build, two artifacts | lynx-website `docs/en/guide/start/fragments/web/integrating-lynx-with-web.mdx`, confirmed by `bun run build:mobile` |
| Rspeedy loads `.env*` and inlines `PUBLIC_*` as `import.meta.env.*` | `apps/mobile/src/build-env.ts` | `@lynx-js/rspeedy` `createRspeedy({ loadEnv = true })` |
| The template encoder drops unsupported CSS (e.g. `text-transform`) with a build warning | keep the build warning-free | `bun run build:mobile` output |
| The ReactLynx test transform parses `.ts` files like TSX, so generic arrow functions `<T>(…) =>` fail | write generic helpers as `function name<T>()` | `apps/mobile` Rstest run |
| Rspeedy, Rstest and Lynxtron run under Node (≥ 20.19 / 22.18) | ADR-0002 | lynx-website quick start, Lynxtron introduction |

When upgrading Lynx packages, re-check this table and say in the changeset which rows changed.
