# Android host (Kotlin)

Reference sources for running `apps/mobile/dist/main.lynx.bundle` in an Android app.
Not compiled by this repo's CI — see the STATUS section in [`../README.md`](../README.md).

| File | Role |
| --- | --- |
| `AwcmsHostBridgeModule.kt` | `LynxModule` named `AwcmsHostBridge`, plus the pure `HostBridgeDispatcher` (contract logic, JVM-testable) |
| `KeystoreSecureStore.kt` | AES-256-GCM over the Android Keystore, ciphertext in private `SharedPreferences` |
| `AwcmsLynxHost.kt` | `LynxEnv` init + module registration, `LynxView` builder with `globalProps`, bundle provider (assets / debug dev-server), deep-link forwarding, a base `Activity` |
| `proguard-rules.pro` | R8 snippet |

Derived from `lynx-family/integrating-lynx-demo-projects` `android/KotlinEmptyProject` (Apache-2.0).
That project pins Lynx 3.8.0; the Lynx docs (`version.json`) pin **4.1.0 / PrimJS 4.1.1** — this
reference follows the 4.1 docs. Pick one version and pin it.

## 1. Wire it in

`app/build.gradle.kts` (dependency list from the integration guide; add the `xelement-*`
artifacts your bundle's elements need — `<input>` needs `xelement-input`):

```kotlin
android {
    compileSdk = 34
    defaultConfig { minSdk = 24; targetSdk = 34 }   // sample values; Keystore AES-GCM needs >= 23
}
dependencies {
    val lynx = "4.1.0"
    implementation("org.lynxsdk.lynx:lynx:$lynx")
    implementation("org.lynxsdk.lynx:lynx-jssdk:$lynx")
    implementation("org.lynxsdk.lynx:lynx-trace:$lynx")
    implementation("org.lynxsdk.lynx:primjs:4.1.1")
    implementation("org.lynxsdk.lynx:lynx-service-image:$lynx")
    implementation("com.facebook.fresco:fresco:2.3.0")
    implementation("com.facebook.fresco:animated-gif:2.3.0")
    implementation("com.facebook.fresco:animated-webp:2.3.0")
    implementation("com.facebook.fresco:webpsupport:2.3.0")
    implementation("com.facebook.fresco:animated-base:2.3.0")
    implementation("org.lynxsdk.lynx:lynx-service-log:$lynx")
    implementation("org.lynxsdk.lynx:lynx-service-http:$lynx")
    implementation("com.squareup.okhttp3:okhttp:4.9.0")
    implementation("org.lynxsdk.lynx:xelement:$lynx")
    implementation("org.lynxsdk.lynx:xelement-input:$lynx")

    // Devtool only in debug builds (QR-code / inspector), never shipped to users:
    debugImplementation("org.lynxsdk.lynx:lynx-devtool:$lynx")
    debugImplementation("org.lynxsdk.lynx:lynx-service-devtool:$lynx")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // org.json is stubbed in JVM unit tests
}
// gradle.properties: android.useAndroidX=true   (Fresco depends on AndroidX)
```

`Application`:

```kotlin
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        AwcmsLynxHost.initLynx(this)
    }
}
```

`MainActivity` (per-flavour defaults; one signed binary can still be repointed with globalProps
from the Activity, which is how staging vs production is chosen):

```kotlin
class MainActivity : AwcmsLynxActivity() {
    override fun runtimeConfig() = AwcmsRuntimeConfig(
        backend = "awcms-one",
        apiBaseUrl = BuildConfig.AWCMS_API_BASE_URL,   // buildConfigField per flavour
        storefrontOrigin = BuildConfig.AWCMS_STOREFRONT_ORIGIN,
        locale = "id",
        environment = if (BuildConfig.DEBUG) "development" else "production",
    )
}
```

`AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<application
    android:name=".App"
    android:allowBackup="false"
    android:dataExtractionRules="@xml/data_extraction_rules"
    android:fullBackupContent="@xml/backup_rules"
    android:usesCleartextTraffic="false">
    <activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
        <!-- Custom-scheme deep link. Universal/App Links (https + assetlinks.json): TODO, see ../README.md -->
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="awcmslynx" />
        </intent-filter>
    </activity>
</application>
```

`res/xml/backup_rules.xml` and `data_extraction_rules.xml`: exclude the encrypted prefs. The Keystore
key does not survive a restore, so the restored ciphertext would be dead weight (the store would
drop it on first read) — excluding it makes the intent explicit:

```xml
<!-- backup_rules.xml -->
<full-backup-content>
    <exclude domain="sharedpref" path="awcms_lynx_secure.xml" />
</full-backup-content>
<!-- data_extraction_rules.xml -->
<data-extraction-rules>
    <cloud-backup><exclude domain="sharedpref" path="awcms_lynx_secure.xml" /></cloud-backup>
    <device-transfer><exclude domain="sharedpref" path="awcms_lynx_secure.xml" /></device-transfer>
</data-extraction-rules>
```

## 2. Bundle loading

* Release: `apps/mobile/dist/main.lynx.bundle` is copied to `app/src/main/assets/main.lynx.bundle`
  (a Gradle `Copy` task or CI step; the bundle is covered by the APK signature).
* Debug: run `bun run --cwd apps/mobile dev`, then launch with the dev-server URL
  (`adb shell am start -n <pkg>/.MainActivity --es awcms.bundleUrl http://10.0.2.2:3000/main.lynx.bundle`;
  `10.0.2.2` is the emulator's alias for the host; use the LAN IP on a device). Intent overrides are
  ignored in non-debuggable builds, and `AwcmsTemplateProvider` refuses `http(s)` there too.
* Cleartext HTTP to the dev server needs a **debug-only** network security config
  (`app/src/debug/res/xml/network_security_config.xml`, referenced from `app/src/debug/AndroidManifest.xml`
  with `tools:replace="android:networkSecurityConfig"`). Never `usesCleartextTraffic="true"` in main/release:

```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">192.168.1.10</domain> <!-- your dev machine -->
    </domain-config>
</network-security-config>
```

The app's own backend calls (`@awcms-lynx/client`) go through the **Lynx HTTP service**
(`lynx-service-http`, OkHttp), so they obey the same network security config. The AWCMS
offline-LAN deployment profile (plain HTTP to a private IP) therefore needs a per-flavour
network security config too.

## 3. Devtool in debug builds

Copy `YourApplication.initLynxService/initLynxEnv` devtool lines from the sample into a class under
`app/src/debug/java/...` (e.g. a `DebugLynx.init(app)` that `registerService(LynxDevToolService.INSTANCE)`
and `LynxDevtoolGlobalHelper.getInstance().registerCardListener {...}`), and provide a no-op twin under
`src/release`. Keeping it out of `main` means no devtool classes in the release APK.

## 4. Unit-testing the contract

`HostBridgeDispatcher` has no Lynx dependency. Replay `../contract-test-vectors.json` against it with a
fake `SecureStore` (in-memory map) and a fake `LinkOpener` (records the URL, returns true). Add a second,
instrumented test that runs the same vectors against `KeystoreSecureStore` on a device/emulator.

## 5. Security notes

* Keys are validated against `^awcms-lynx:[a-z0-9:._-]{1,96}$` and values capped at 16384 UTF-16 units
  before touching the Keystore. `link.open` refuses non-`http(s)`, whitespace/control characters,
  userinfo (`user@host`) and missing hosts.
* The storage key is the GCM AAD, so ciphertext cannot be moved between keys.
* Any bundle running in the LynxView can call `secureStorage.get` for any well-formed key. The
  Keystore protects data at rest, **not** against a malicious bundle: only ship bundles you built,
  from assets (OTA bundles need their own signature check — TODO, see `../README.md`).
* Hardening idea (docs: `guide/use-native-modules.mdx`, "Native Module Permission Verification
  (Experimental)"): `LynxViewBuilder.registerModuleAuthValidator` can allow-list `AwcmsHostBridge.call`
  only. The documented interface snippet is internally inconsistent — VERIFY the real signature first.
* Rotate the key alias (`-v2`) and re-encrypt if the format ever changes; the `v1.` prefix is there for that.

## VERIFY list (this directory)

1. `ReadableMap.toHashMap()` exists (`AwcmsHostBridgeModule.kt`).
2. Behaviour for wrong JS argument types on a `@LynxMethod` (`AwcmsHostBridgeModule.kt`).
3. `LynxView.loadTemplate(LynxLoadMeta)` + `LynxLoadMeta.Builder.setGlobalProps` on the pinned SDK; the sample uses `renderTemplateUrl` (`AwcmsLynxHost.kt`).
4. `JavaOnlyArray.of(...)` (`AwcmsLynxHost.kt`).
5. `AbsTemplateProvider.Callback.onSuccess/onFailed` signatures (`AwcmsLynxHost.kt`).
6. The androidx.security deprecation wording (`KeystoreSecureStore.kt`).
