# Status — what is verified, per target

Last updated 21 November 2026. "Verified" means it was run in this repository's environment (Linux, Bun 1.4.4, Node 22.22) or CI; everything else is labelled. A derived product copies this page and fills in its own proof-of-concept results (awcms-one ADR-0050 D6, awcms ADR-0146 §5).

## Building blocks

| Piece | State | Evidence |
| --- | --- | --- |
| `@awcms-lynx/client` (both backend profiles) | Verified by unit tests against the documented contract; **not** run against a live backend here. `X-Correlation-ID` is omitted on the Web host and sent on native hosts, covered by client unit tests and one app-level wiring test | `bun test packages/client` (124 tests) |
| `@awcms-lynx/platform` contract, bridge, runtime config | Verified | `bun test packages/platform` |
| JS hosts vs. the 74 contract vectors | Verified (web and desktop hosts) | `tests/contract-vectors.test.ts` |
| `@awcms-lynx/app` UI (both profiles) | Verified in the ReactLynx test renderer | `bun run test:ui` |
| Repository policy (no forbidden runtime APIs, no secrets, ADR index, mirrors, links) | Verified | `tests/repo-policy.test.ts` |

## Targets

| Target | Builds | Runs | Not yet verified |
| --- | --- | --- | --- |
| Lynx bundle (`main.lynx.bundle`) | ✅ `bun run build:mobile` | ✅ loaded by the real Lynxtron runtime (headless) | on a device in Lynx Explorer |
| Web (`main.web.bundle` + `apps/web`) | ✅ `bun run build` | ✅ Chromium under the production CSP: UI rendered, host bridge answered | Safari, Firefox; real Caddy/nginx; a live backend behind the proxy |
| Desktop (Lynxtron, macOS/Windows) | ✅ `bun run build:desktop` | ✅ headless Lynxtron run on Linux answered `app.info`/`secureStorage` | windowed run, `dev`, `pack`, signing — needs macOS/Windows |
| Android host | ✅ `./gradlew assembleDebug lintDebug` in `hosts/android` (Lynx 4.1.0, AGP 8.9.1, Gradle 8.13), CI job `android` | ⬜ the 74 vectors pass in JUnit on the JVM (`testDebugUnitTest`); not run on a device | device or emulator run, `KeystoreSecureStore` against the vectors, release/R8 build, signing (`hosts/android/README.md` VERIFY list) |
| iOS host | ⬜ reference sources | ⬜ | same with XCTest (`hosts/ios/README.md`) |
| HarmonyOS host | ⬜ reference sources | ⬜ | same with hypium (`hosts/harmony/README.md`); most uncertainty |

## Known limits

- **Lynx versions.** JS packages: `@lynx-js/react` 0.129.2, `@lynx-js/rspeedy` 0.18.5, `@lynx-js/web-core` 0.26.5, Lynxtron 0.0.30. The Android host is built against Lynx 4.1.0 / PrimJS 4.1.1 (ADR-0006); the official Harmony sample pins 3.8.x while docs and Explorer are at 4.x; a product picks one engine version for all native hosts.
- **Session storage**: hardware-backed only on the native hosts (not yet run on a device); desktop uses an owner-only file (`app-file`, Lynxtron 0.0.30 has no keyring API); the Web uses browser storage.
- **Backend gaps** that keep a persona app at PoC grade are listed in [`backend-integration.md`](backend-integration.md#gaps); the 20 November 2026 re-check, with the classification of each and the finding that no test here touches a live backend, is [`contract-validation-2026-11.md`](contract-validation-2026-11.md).
- **Not in v1**: deep links, push token retrieval, camera/location/barcode, offline cache — each needs a host-contract bump (ADR-0003 consequences).

## Owner decisions of 20 November 2026

Source: the contract validation of issue #19 ([`contract-validation-2026-11.md`](contract-validation-2026-11.md)). Recorded as decisions of the owner; none of them is evidence that a target works.

- **D-1.** `awcms` ADR-0146 (persona apps, still Proposed there) is to be accepted after the first proof of concept, not now. This repository changes nothing until a PoC exists; persona apps stay at PoC grade.
- **D-2.** Contract tooling follows `awcms` option C′: a generator inside `awcms` and a pinned fixture package published for consumers (`awcms` #1379; its ADR has no number yet). The client conformance check will use that package and is tracked in #22, blocked on the package and on gate 9.
- **D-3.** The proxy-only rule stays; `X-Correlation-ID` is optional on the Web target and still sent on native targets ([ADR-0005](adr/0005-correlation-id-is-optional-on-the-web-target.md), issue #21). `awcms-one` is not asked to change its CORS allowlist. Not observed in a browser; the preflight behaviour is a reading of backend source.
