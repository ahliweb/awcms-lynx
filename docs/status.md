# Status — what is verified, per target

Last updated 25 October 2026. "Verified" means it was run in this repository's environment (Linux, Bun 1.4.4, Node 22.22) or CI; everything else is labelled. A derived product copies this page and fills in its own proof-of-concept results (awcms-one ADR-0050 D6, awcms ADR-0146 §5).

## Building blocks

| Piece | State | Evidence |
| --- | --- | --- |
| `@awcms-lynx/client` (both backend profiles) | Verified by unit tests against the documented contract; **not** run against a live backend here | `bun test packages/client` (119 tests) |
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
| Android host | ⬜ reference sources | ⬜ | compile against the pinned Lynx version, vectors in JUnit, device run (`hosts/android/README.md` VERIFY list) |
| iOS host | ⬜ reference sources | ⬜ | same with XCTest (`hosts/ios/README.md`) |
| HarmonyOS host | ⬜ reference sources | ⬜ | same with hypium (`hosts/harmony/README.md`); most uncertainty |

## Known limits

- **Lynx versions.** JS packages: `@lynx-js/react` 0.129.0, `@lynx-js/rspeedy` 0.18.3, `@lynx-js/web-core` 0.26.5, Lynxtron 0.0.30. The official native samples pin Lynx 3.8.x (Android/Harmony) while docs and Explorer are at 4.x; a product picks one engine version for all native hosts.
- **Session storage**: hardware-backed only on the native hosts (once compiled); desktop uses an owner-only file (`app-file`, Lynxtron 0.0.30 has no keyring API); the Web uses browser storage.
- **Backend gaps** that keep a persona app at PoC grade are listed in [`backend-integration.md`](backend-integration.md#gaps).
- **Not in v1**: deep links, push token retrieval, camera/location/barcode, offline cache — each needs a host-contract bump (ADR-0003 consequences).
