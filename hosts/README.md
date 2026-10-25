# Native hosts

One ReactLynx bundle (`apps/mobile` -> `dist/main.lynx.bundle`) runs inside a thin native shell on
**Android, iOS and HarmonyOS**. This directory holds the reference sources for those shells. A host does
exactly four things: initialise the Lynx engine, load the bundle, hand it runtime configuration, and
answer the host-bridge contract. Everything else is the bundle's job.

```
hosts/
  README.md                    this file
  contract-test-vectors.json   request/reply vectors replayed by a native unit test on each platform
  android/   AwcmsHostBridgeModule.kt  KeystoreSecureStore.kt  AwcmsLynxHost.kt  proguard-rules.pro  README.md
  ios/       AwcmsHostBridgeModule.swift  KeychainSecureStore.swift  AwcmsLynxHost.swift  Podfile.snippet  README.md
  harmony/   AwcmsHostBridgeModule.ets  HuksSecureStore.ets  AwcmsLynxHost.ets  oh-package.json5.snippet  README.md
```

Parts adapted from `lynx-family/integrating-lynx-demo-projects` (Apache-2.0) say so in their file header;
keep that notice when you copy them into a product repo (the repo itself is MIT).

## STATUS — read this first

**These are reference sources, not a compiled, tested product.** They are not built by this repo's CI
(no Android SDK, Xcode or DevEco toolchain there), have never been run on a device, and were written
against the official empty host projects and the Lynx documentation only. Every API use that the
docs do not pin down is marked `VERIFY:` in the source and listed at the bottom of each platform README.
Treat the first build as a proof of concept: **verify in the ADR-0050 D6 / ADR-0146 §5 PoC** (build
each host against the pinned Lynx version, replay `contract-test-vectors.json`, then run the release
checklist below on real devices) before anything here is called supported. HarmonyOS carries the most
uncertainty; iOS second.

Version note: the official sample projects pin different Lynx versions (Android 3.8.0, Harmony 3.8.1,
iOS pods 4.1.0), the Harmony guide says 4.0.0, and the docs' `version.json` says 4.1.0 / PrimJS 4.1.1.
Pick one Lynx version for all three hosts and for the `@lynx-js/*` JS packages, then re-check the
`VERIFY` items against that version.

## The host-bridge contract

Source of truth: `packages/platform/src/contract.ts` (+ `bridge.ts`). Every native host registers one Lynx
NativeModule, **`AwcmsHostBridge`**, with one method:

```
NativeModules.AwcmsHostBridge.call(method: string, params: object, callback: (reply) => void)
```

The reply is `{"ok":true,"result":{...}}` or `{"ok":false,"error":{"code":"...","message":"..."}}`. These hosts
always send it as a **JSON string** (`parseHostReply` accepts both).

| Method | Params | Result | Errors |
| --- | --- | --- | --- |
| `secureStorage.get` | `{key}` | `{value: string \| null}` | `INVALID_PARAMS`, `STORAGE_UNAVAILABLE` |
| `secureStorage.set` | `{key, value}` | `{stored: true}` | `INVALID_PARAMS`, `STORAGE_UNAVAILABLE` |
| `secureStorage.delete` | `{key}` | `{deleted: true}` (idempotent) | `INVALID_PARAMS`, `STORAGE_UNAVAILABLE` |
| `app.info` | `{}` | `{host, hostBridgeVersion: 1, appVersion, secureStorage}` | – |
| `link.open` | `{url}` | `{opened: boolean}` | `INVALID_PARAMS`, `FORBIDDEN_SCHEME` |
| anything else | – | – | `UNKNOWN_METHOD` |

`host` is `android` / `ios` / `harmony`; `secureStorage` is `android-keystore` / `keychain` / `harmony-huks`.
Any other failure is `HOST_ERROR`. Rules every host enforces natively (the JS layer validates too, hosts never trust it):

* storage keys match `^awcms-lynx:[a-z0-9:._-]{1,96}$`; values are strings of at most 16384 UTF-16 code units;
* `link.open` accepts `http`/`https` only; the scheme is checked after rejecting whitespace/control characters,
  and a host is required;
* no input may crash the host, and nothing about keys, values or URLs is logged.

The JS side applies the same rules: `checkHostParams` in `packages/platform/src/contract.ts` (no
`user@host` userinfo, no control characters or spaces, host required, 2048-character cap, `FORBIDDEN_SCHEME`
for a well-formed non-http(s) URL, `INVALID_PARAMS` for anything malformed). `tests/contract-vectors.test.ts`
replays every vector against the web and desktop hosts in CI, so the vectors and the JS hosts cannot drift.

### Contract test vectors

`contract-test-vectors.json` has 74 independent cases (valid get/set/delete round trip, boundary key/value sizes,
invalid keys, oversize and non-string values, malformed params, unknown methods, `app.info`, valid and forbidden
`link.open`). The `semantics` block explains matching rules, `$repeat` generators and the recording link opener.
Each host's `HostBridgeDispatcher` is written so the vectors replay with an in-memory store and a fake opener
(JUnit / XCTest / hypium), and the storage cases replay again against the real secure store on a device.
(The vector file was cross-checked against a JavaScript model of the dispatcher logic; the native code was not run.)

## How the bundle is loaded

| | Release | Debug |
| --- | --- | --- |
| Android | `assets/main.lynx.bundle` via `AbsTemplateProvider` | assets, or `http(s)` dev-server URL (debuggable builds only, runtime `FLAG_DEBUGGABLE` check) |
| iOS | `main.lynx.bundle` in *Copy Bundle Resources* via `LynxTemplateProvider` | embedded, or dev-server URL (`#if DEBUG`: the code is not compiled into release) |
| Harmony | `resources/rawfile/main.lynx.bundle` via `LynxTemplateResourceFetcher` | rawfile, or dev-server URL (`BuildProfile.DEBUG`) |

Release builds only ever execute the bundle that was packaged and signed with the app. Remote/OTA bundles are
**not** supported and would need their own integrity check (signature over the bundle, pinned key) before being enabled — TODO.
The dev flow: `bun run --cwd apps/mobile dev` (rspeedy) prints the bundle URL; point a debug build at it.
Build the production bundle with `bun run --cwd apps/mobile build` and copy `dist/main.lynx.bundle` into each host's
asset location (a CI step, not a manual copy).

## Runtime configuration via `globalProps`

One signed binary can target staging or production because the host passes overrides as Lynx **globalProps**
(`lynx.__globalProps`), which `resolveRuntimeConfig` in `packages/platform/src/runtime-config.ts` merges over build-time defaults:

| key | meaning |
| --- | --- |
| `backend` | `awcms` (staff/member app) or `awcms-one` (customer app) |
| `apiBaseUrl` | backend origin, `https` (http only for loopback / private LAN) |
| `storefrontOrigin` | awcms-one only |
| `tenantId` | awcms only, UUID |
| `locale` | `en` / `id` |
| `appName`, `environment` | display name; `development` / `production` |

How each host sets them: Android `LynxLoadMeta.Builder.setGlobalProps(TemplateData.fromMap(...))`; iOS
`LynxLoadMeta.globalProps = LynxTemplateData(dictionary:)`; Harmony `new MetaData(initData, new TemplateData(globalProps))`.
They can be changed later (`updateGlobalProps`) without reloading. **globalProps are not secret**: any script in the bundle can read them.
Never put credentials in them. In release builds, host-side overrides come from build configuration only; the
Android debug-only Intent extras (`awcms.apiBaseUrl`, `awcms.bundleUrl`) are ignored in non-debuggable builds, because
an exported launcher Activity must not let another app repoint a release app's backend.

## Secure storage and threat model

| Platform | Mechanism | Where ciphertext lives | Survives app deletion | In backups |
| --- | --- | --- | --- | --- |
| Android | AES-256-GCM, non-exportable AndroidKeystore key, key alias `awcms-lynx-aes-gcm-v1`; storage key bound as AAD | private `SharedPreferences` `awcms_lynx_secure` | No | Excluded by rules; key would not restore anyway |
| iOS | Keychain `kSecClassGenericPassword`, service `id.ahliweb.awcms.lynx`, `AfterFirstUnlockThisDeviceOnly`, not synchronizable | Keychain | **Yes** — purged on first launch after install | Not migrated (`ThisDeviceOnly`) |
| HarmonyOS | AES-256-GCM, HUKS key `awcms-lynx-aes-gcm-v1`; storage key as AAD | `@kit.ArkData` Preferences `awcms_lynx_secure` | No | Key does not travel; entry dropped on read |

Why Android uses a small Keystore wrapper rather than `EncryptedSharedPreferences`: that library
(`androidx.security:security-crypto`) is deprecated, drags in Tink and a MasterKey layer, and we need only "encrypt one
string under a hardware-backed key". Why Harmony uses HUKS + Preferences rather than the Asset Store Kit: the Asset
Store is the right vault for secrets up to roughly 1 KiB, but the contract allows 16 KiB. Both are swappable behind the
store interface. Details are in each store's header comment.

Protects against: reading app storage from a backup or a forensic copy of the data directory; moving ciphertext
to another device; swapping ciphertext between keys (AAD binding); a stale token resurrected after reinstall (iOS purge).

Does **not** protect against:

* a rooted/jailbroken device or an attacker running code inside the app process;
* **a malicious or compromised bundle** — any script in the LynxView can call `secureStorage.get` for any well-formed
  key. At-rest encryption is not authorisation. Ship only bundles you built and signed (see bundle loading above);
* screenshots/screen recording, accessibility services, shoulder-surfing;
* a stolen unlocked device: no biometric/passcode gate is applied to the session (it must be readable in the background);
  gate sensitive *actions* in the app instead, or add `SecAccessControl` / `setUserAuthenticationRequired` for a step-up secret.

`app.info.secureStorage` tells the app the truth about the backend; the app refuses to label a session "secure"
when the host reports `memory` or `browser-storage` (Lynx Explorer, tests).

## Deep links

* **Custom scheme (implemented as a hook):** `awcmslynx://...` (change the scheme per product). Android `intent-filter`
  with `BROWSABLE`; iOS `CFBundleURLTypes`; Harmony a `skills` entry with `uris: [{scheme}]`. The host forwards only its own
  scheme, length-capped, to the bundle as a **global event** `awcms:deeplink` with the URL string as the single parameter
  (`LynxView.sendGlobalEvent` / `LynxContext.sendGlobalEvent`); a cold-start link is queued until the view exists.
  PROPOSAL: nothing in `apps/mobile` listens to `awcms:deeplink` yet, and its name/payload are not in the contract. Add a
  `useLynxGlobalEventListener('awcms:deeplink', ...)` router, treat the URL as untrusted input (allow-list routes, never
  navigate to arbitrary hosts), and record the event in the contract before relying on it.
* **Universal Links / Android App Links / Harmony App Linking (https): TODO.** Needs the storefront/backend domain to
  serve `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` and the Harmony equivalent, plus
  the matching entitlement / `autoVerify="true"` intent filter / `appLinking` config. Custom schemes can be claimed by any
  app, so nothing security-relevant (login callbacks, payment returns) may depend on them.

## Push notifications

AWCMS registers device tokens at `POST /api/v1/push/subscriptions` with `transport: 'fcm'` (the client method is
`registerPush({transport: 'fcm', endpoint: <token>})`; `web_push` is the browser transport; `fcm` bodies carry **no** keys).
There is no APNs transport, so:

* **Android:** Firebase Messaging; the FCM registration token is the `endpoint`. Android 13+ needs the `POST_NOTIFICATIONS` runtime permission.
* **iOS:** also Firebase Messaging (Firebase iOS SDK + APNs capability + APNs key uploaded to Firebase). The SDK exchanges the
  APNs token for an FCM token, which is what AWCMS stores. Do not send raw APNs tokens to the backend.
* **HarmonyOS:** unsupported. FCM is not generally available there and AWCMS has no Push Kit transport; do not fake a token.

Contract gap: v1 has no push method. Recommended: hostBridgeVersion 2 adds `push.getToken` (permission prompt + token) and the
bundle calls `registerPush` itself after login, re-registers on token refresh (host emits `awcms:push-token`), and
`deletePush` on logout. Notification taps arrive as deep links (above). Not implemented in these sources.

## Release checklist

Common
- [ ] One Lynx version pinned across Android/iOS/Harmony and JS; `VERIFY` items resolved and the comments removed.
- [ ] `contract-test-vectors.json` passes on every platform, with the fake store **and** the real secure store on a device.
- [ ] `bun run --cwd apps/mobile build` output copied by CI; bundle hash recorded with the release.
- [ ] Backend URL for the release flavour is `https`; no staging URL, dev-server URL or debug Intent extra reachable.
- [ ] Devtool, LogBox and Lynx debug flags are absent from release (they are debug-only code paths in these sources).
- [ ] No secret in globalProps, bundle, assets or logs; `app.info.secureStorage` shows the real backend on a device.
- [ ] Privacy/data-safety forms updated (tokens stored on device, push token sent to AWCMS and Google).

Android
- [ ] Signing: Play App Signing + upload key; keystore/credentials not in the repo.
- [ ] `isMinifyEnabled = true`, `proguard-rules.pro` has the Lynx block **and** `hosts/android/proguard-rules.pro`; test `call` works in the release build (obfuscation breaks reflection silently).
- [ ] `minSdk 24 / targetSdk & compileSdk 34` (sample values; Keystore AES-GCM needs 23+) — re-check against Play's current target requirement.
- [ ] `allowBackup="false"` or the rules exclude `awcms_lynx_secure.xml`; `usesCleartextTraffic="false"`; debug-only network security config for the dev server.
- [ ] Manifest: only `INTERNET` (+ `POST_NOTIFICATIONS` when push ships); launcher Activity is the only exported component.

iOS
- [ ] Signing: distribution certificate, provisioning profile; push entitlement only if push ships.
- [ ] Deployment target per Lynx pods (`platform :ios, '10.0'` in the docs; raise to what current Xcode and the pods require).
- [ ] ATS fully on in Release (`NSAllowsLocalNetworking` only in Debug, or a reviewed exception for offline-LAN deployments).
- [ ] `PrivacyInfo.xcprivacy`: declare the UserDefaults required-reason API used by `purgeOnFreshInstall` (and anything the Lynx pods report).
- [ ] *User Script Sandboxing = NO* for the Pods scripts; Release builds contain no `#if DEBUG` dev-server path (verify with a symbol check).
- [ ] Keychain verified on a device, including first-unlock-after-boot behaviour and reinstall.

HarmonyOS
- [ ] Signing config (certificate + profile) in `build-profile.json5` for release; `targetSdkVersion`/`compatibleSdkVersion` `6.0.0(20)` per the sample.
- [ ] Obfuscation (`obfuscation-rules.txt`) enabled in release must keep the `AwcmsHostBridgeModule` class and its `call` method name — the sample's rules enable property/top-level obfuscation, which would rename `call` (add `-keep-property-name call` and keep the class). VERIFY on a release build.
- [ ] `@lynx/*` versions published on ohpm; devtool only in debug; cleartext only in debug.
- [ ] HUKS key and Preferences verified on a device (emulators may not implement HUKS fully).
