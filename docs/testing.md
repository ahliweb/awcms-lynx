# Testing

| Layer | Runner | Where | Command |
| --- | --- | --- | --- |
| API client | `bun test` | `packages/client/src/__tests__/` | `bun test packages/client` |
| Host contract, runtime config, web host handler | `bun test` | `packages/platform/src/__tests__/` | `bun test packages/platform` |
| Repository policy, changesets, versions | `bun test` | `tests/` | `bun test tests` |
| ReactLynx UI (both backend profiles, settings honesty, config error) | Rstest + `@lynx-js/react/testing-library` | `apps/mobile/src/__tests__/` | `bun run test:ui` |
| Bundles | Rspeedy / Rsbuild | `apps/mobile`, `apps/web`, `apps/desktop` | `bun run build`, `bun run build:desktop` |
| Native host contract | platform unit tests (in the product) | replay `hosts/contract-test-vectors.json` | per `hosts/README.md` |

`bun run check` runs lint, type-check, `bun test`, the UI tests and the builds — the same steps as `.github/workflows/ci.yml`.

## Conventions

- **No network in tests.** The client takes `fetch` by injection; tests pass a fake that answers by URL and records requests.
- **Test the contract, not the implementation.** Client tests assert the exact path, headers (`X-AWCMS-Tenant-ID` present on staff routes, absent on commerce routes), body and the typed outcome/error.
- **UI tests use the real client** over a fake `fetch` and the in-memory host bridge, so a screen test also proves the wiring.
- **Every backend fact has a test.** When a backend contract changes, the failing test is the reminder to update `docs/backend-integration.md`.
- Bugs found by a test are fixed in the code, never by loosening the assertion (the first UI run found `health()` wrongly refused on the `awcms-one` profile).

## What CI cannot test

Device builds (Xcode, Gradle, DevEco), real secure storage, push, camera and screen readers need devices. They are the per-product PoC gate (awcms-one ADR-0050 D6, awcms ADR-0146 §5); [`status.md`](status.md) records which have been run.
