---
bump: minor
type: structure
impact: public
---

# The Android host is a Gradle project that CI builds and unit-tests

Issue #24. The Android host was reference Kotlin that nothing compiled. A downstream build spike (2026-11-21) compiled it against Lynx 4.1.0 and found a real error: `LynxLoadMeta.Builder` setters return `void`, so the chained call in `AwcmsLynxHost.createView` did not compile. The host is now built in CI so that kind of drift is caught here.

- `hosts/android`: Gradle Kotlin DSL project (wrapper 8.13 with checksum, AGP 8.9.1, Kotlin 2.0.21, Lynx 4.1.0 / PrimJS 4.1.1, compileSdk/targetSdk 36, minSdk 24), `app` module with `App`, `MainActivity`, manifest and backup rules, placeholder application id `id.ahliweb.awcms.lynx`. The existing `*.kt` reference sources are the compiled sources; a Gradle task copies `apps/mobile/dist/main.lynx.bundle` into the assets and fails clearly when it is missing. Devtool artifacts are `debugImplementation` only; debug keystore only.
- Fix: `AwcmsLynxHost.createView` calls `setUrl`/`setGlobalProps` on a builder variable.
- Fix: `KeystoreSecureStore` accepted blobs only above 28 bytes, but an empty value encrypts to exactly 28 (IV + GCM tag), so valid empty entries read as `null` (vector `storage.empty-value`); the bound is inclusive now. Found by a downstream runtime spike (2026-11-21).
- Tests: a JUnit test replays all 74 `contract-test-vectors.json` cases against `HostBridgeDispatcher` (plus fault tests for `STORAGE_UNAVAILABLE` and `HOST_ERROR`, and the blob-size bound).
- CI: new `android` job (Bun bundle build, JDK 21, the runner's Android SDK, Gradle wrapper validation, `assembleDebug lintDebug testDebugUnitTest`); its actions are pinned by commit SHA.
- Docs: new [ADR-0006](../docs/adr/0006-android-host-is-a-gradle-project-built-in-ci.md) (proposed), `hosts/android/README.md` (build steps, VERIFY results), `hosts/README.md`, `docs/status.md`, `docs/deployment.md`, `README.md`, with Indonesian mirrors. Still not verified: any device run, the Keystore store, release/R8 builds, signing.
