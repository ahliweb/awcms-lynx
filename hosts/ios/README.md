# iOS host (Swift)

Reference sources for running `apps/mobile/dist/main.lynx.bundle` in an iOS app.
Not compiled by this repo's CI — see the STATUS section in [`../README.md`](../README.md).

| File | Role |
| --- | --- |
| `AwcmsHostBridgeModule.swift` | `LynxModule` named `AwcmsHostBridge`, plus the pure `HostBridgeDispatcher` (contract logic, XCTest-able) |
| `KeychainSecureStore.swift` | Keychain generic-password items, `AfterFirstUnlockThisDeviceOnly` |
| `AwcmsLynxHost.swift` | `LynxEnv` bootstrap, `LynxView` factory with `globalProps`, bundle provider, deep-link forwarding, a view controller |
| `Podfile.snippet` | Lynx 4.1.0 pods, per the docs |

Derived from `lynx-family/integrating-lynx-demo-projects` `ios/HelloLynxSwift` (Apache-2.0).

## 1. Wire it in

1. Merge `Podfile.snippet`, `pod install`, open the `.xcworkspace`, set
   *User Script Sandboxing = NO*.
2. Bridging header (the Lynx pods are Objective-C; same approach as the sample's
   `Hello-Lynx-Bridging-Header.h`):

   ```objc
   #import <Lynx/LynxConfig.h>
   #import <Lynx/LynxEnv.h>
   #import <Lynx/LynxModule.h>
   #import <Lynx/LynxTemplateProvider.h>
   #import <Lynx/LynxTemplateData.h>   // VERIFY header names
   #import <Lynx/LynxLoadMeta.h>
   #import <Lynx/LynxView.h>
   ```
3. `AppDelegate`:

   ```swift
   func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
       AwcmsLynxHost.bootstrap()   // purges stale Keychain items on a fresh install, then LynxEnv.sharedInstance()
       return true
   }
   ```
4. Root view controller (per-scheme defaults come from `Info.plist`/xcconfig, so one signed binary
   configuration can be switched between staging and production):

   ```swift
   let info = Bundle.main.infoDictionary
   let config = AwcmsRuntimeConfig(
       backend: "awcms-one",
       apiBaseUrl: info?["AWCMS_API_BASE_URL"] as? String,
       storefrontOrigin: info?["AWCMS_STOREFRONT_ORIGIN"] as? String,
       locale: "id",
       environment: info?["AWCMS_ENVIRONMENT"] as? String)
   window?.rootViewController = AwcmsLynxViewController(config: config)
   ```
5. Add `main.lynx.bundle` (copy of `apps/mobile/dist/main.lynx.bundle`) to the target's
   *Copy Bundle Resources*. The provider resolves the name `main.lynx` to `main.lynx.bundle`.

## 2. Bundle loading

* Release: embedded bundle only. The remote-fetch branch sits inside `#if DEBUG`, so a release
  binary physically contains no code that runs a downloaded bundle.
* Debug: `bun run --cwd apps/mobile dev`, then pass the dev-server URL as `bundle:`
  (`AwcmsLynxViewController(config: config, bundle: "http://192.168.1.10:3000/main.lynx.bundle")`).
* ATS: the dev server is plain HTTP. In a **Debug-only** `Info.plist` (or an xcconfig-driven
  `INFOPLIST_FILE`) add `NSAppTransportSecurity` -> `NSAllowsLocalNetworking = YES`
  (narrower than `NSAllowsArbitraryLoads`) and, for local-network access on iOS 14+,
  `NSLocalNetworkUsageDescription`. Release keeps ATS fully on; the backend must be HTTPS.
  The AWCMS offline-LAN profile (HTTP to a private IP) needs the same `NSAllowsLocalNetworking`
  exception in whatever configuration ships to those sites — a deliberate, reviewed choice.

## 3. Keychain notes

* Service `id.ahliweb.awcms.lynx` (change with your bundle id), one item per storage key,
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, not synchronizable, default access group.
* Keychain items outlive app deletion: `purgeOnFreshInstall()` clears the service on the first launch
  after install (flag in `UserDefaults`, which is deleted with the app).
* Reads before the first unlock after boot fail with `errSecInteractionNotAllowed` and surface as
  `STORAGE_UNAVAILABLE`; the JS side should retry, not sign the user out.
* Simulator Keychain is not hardware-backed; test security properties on a device.

## 4. Deep links and push

* Custom scheme: `Info.plist` `CFBundleURLTypes` -> `CFBundleURLSchemes = [awcmslynx]`. In the
  `SceneDelegate`: `scene(_:openURLContexts:)` and `connectionOptions.urlContexts` (cold start) call
  `AwcmsLynxViewController.handleDeepLink(_:)`, which sends the global event `awcms:deeplink`.
* Universal Links (`applinks:` entitlement + `apple-app-site-association` on the storefront domain): TODO.
* Push: APNs registration + Firebase Messaging; the FCM token is what AWCMS stores (transport `fcm`).
  See `../README.md` for the flow and why iOS goes through FCM.

## 5. Unit-testing the contract

`HostBridgeDispatcher` needs only Foundation + UIKit (the `UIApplicationLinkOpener` is injectable).
Replay `../contract-test-vectors.json` with an in-memory `SecureStore` and a recording `LinkOpening`
in an XCTest bundle, and again against `KeychainSecureStore` in a hosted test (Keychain access
needs an app host).

## VERIFY list (this directory)

1. `LynxConfig.registerModule(_:)` Swift spelling, and that a per-view registration reaches `NativeModules` (`AwcmsLynxHost.swift`).
2. Header names / Swift spellings for `LynxLoadMeta`, `LynxTemplateData(dictionary:)`, `loadTemplate(_:)`, `updateGlobalProps(with:)`.
3. `id`-typed module method parameters and the calling thread (`AwcmsHostBridgeModule.swift`).
4. Template-load callback can be called from a background queue (`AwcmsLynxHost.swift`, DEBUG path).
5. Re-layout on `preferredLayoutWidth/Height` change vs `updateViewport`.
6. Minimum iOS deployment target with current Xcode (`Podfile.snippet`).
