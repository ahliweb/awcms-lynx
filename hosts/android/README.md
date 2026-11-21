# Android host (Kotlin)

Kotlin host for running `apps/mobile/dist/main.lynx.bundle` in an Android app, as a buildable Gradle
project (Kotlin DSL, [ADR-0006](../../docs/adr/0006-android-host-is-a-gradle-project-built-in-ci.md)).
CI builds a debug APK, runs Android lint and replays the contract vectors on the JVM; it has **not** been run
on a device by this repository — see "VERIFY list" below and the STATUS section in [`../README.md`](../README.md).

## Build

```bash
bun install && bun run build:mobile          # repository root: produces apps/mobile/dist/main.lynx.bundle
cd hosts/android
export ANDROID_HOME=$HOME/Android/Sdk        # or sdk.dir in local.properties (git-ignored)
./gradlew assembleDebug lintDebug testDebugUnitTest
```

Needs JDK 17+ (CI uses Temurin 21; the code targets Java 17) and Android SDK platform 36 with build-tools 36.0.0.
Output: `app/build/outputs/apk/debug/app-debug.apk` (signed with the debug keystore only). The build fails with an
explicit message when the bundle is missing; it copies the bundle into the APK assets (`main.lynx.bundle`).

| Pinned | Version |
| --- | --- |
| Lynx / PrimJS | 4.1.0 / 4.1.1 |
| Android Gradle Plugin / Gradle / Kotlin | 8.9.1 / 8.13 / 2.0.21 |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 |

Layout: the `*.kt` files in this directory are the compiled host sources (a `Sync` task stages them);
`app/` adds `App`, `MainActivity`, the manifest, backup rules and the tests. The application id and namespace
`id.ahliweb.awcms.lynx` are placeholders — rename them first in a product (`app/build.gradle.kts`, package
directory, manifest). `AWCMS_API_BASE_URL` / `AWCMS_STOREFRONT_ORIGIN` are `*.invalid` placeholders in
`app/build.gradle.kts`.

| File | Role |
| --- | --- |
| `AwcmsHostBridgeModule.kt` | `LynxModule` named `AwcmsHostBridge`, plus the pure `HostBridgeDispatcher` (contract logic, JVM-testable) |
| `KeystoreSecureStore.kt` | AES-256-GCM over the Android Keystore, ciphertext in private `SharedPreferences` |
| `AwcmsLynxHost.kt` | `LynxEnv` init + module registration, `LynxView` builder with `globalProps`, bundle provider (assets / debug dev-server), deep-link forwarding, a base `Activity` |
| `proguard-rules.pro` | R8 snippet |

Derived from `lynx-family/integrating-lynx-demo-projects` `android/KotlinEmptyProject` (Apache-2.0).
That project pins Lynx 3.8.0; the Lynx docs (`version.json`) pin **4.1.0 / PrimJS 4.1.1**, which is what
this host builds against. A product that changes the version re-runs the build and the VERIFY list.

## 1. How it is wired

The snippets below are the parts of `app/build.gradle.kts`, `App`, `MainActivity`, the manifest and the backup
rules that are committed in `app/`; they stay here to explain the choices when you adapt them. Add the
`xelement-*` artifacts your bundle's elements need (`<input>` needs `xelement-input`):

```kotlin
android {
    compileSdk = 36
    defaultConfig { minSdk = 24; targetSdk = 36 }   // Keystore AES-GCM needs >= 23
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

* Release: `apps/mobile/dist/main.lynx.bundle` is copied into the APK assets as `main.lynx.bundle` by the
  `copyLynxBundle` Gradle task (`app/build.gradle.kts`; the bundle is covered by the APK signature).
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

The build already limits the devtool **artifacts** to debug (`debugImplementation`). Registering the devtool
service is not done in this project yet; to add it, copy the `YourApplication.initLynxService/initLynxEnv` devtool lines from the sample into a class under
`app/src/debug/java/...` (e.g. a `DebugLynx.init(app)` that `registerService(LynxDevToolService.INSTANCE)`
and `LynxDevtoolGlobalHelper.getInstance().registerCardListener {...}`), and provide a no-op twin under
`src/release`. Keeping it out of `main` means no devtool classes in the release APK.

## 4. Unit-testing the contract

`app/src/test/kotlin/.../HostBridgeDispatcherTest.kt` replays every case of `../contract-test-vectors.json`
against `HostBridgeDispatcher` with an in-memory `SecureStore` and a recording `LinkOpener` (a JUnit 4
parameterised test, one test per case; the path reaches the test through the `awcms.contractVectors` system
property). `HostBridgeFaultTest` adds the two cases the vectors list as not covered (`STORAGE_UNAVAILABLE`,
`HOST_ERROR`). Run: `./gradlew testDebugUnitTest`. Still to add: an instrumented test that runs the same vectors
against `KeystoreSecureStore` on a device or emulator.

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

Results of the build described above (Lynx 4.1.0, `./gradlew assembleDebug lintDebug testDebugUnitTest`; "compiled"
means the call type-checks against the pinned SDK — **no item was exercised on a device**):

1. `ReadableMap.toHashMap()` exists — **compiled**; Kotlin reports it as deprecated in Java (warning only). Runtime behaviour on nested maps is unverified (`AwcmsHostBridgeModule.kt`).
2. Behaviour for wrong JS argument types on a `@LynxMethod` — **not verified** (needs a device run with `call(1, 2, 3)`; `AwcmsHostBridgeModule.kt`).
3. `LynxView.loadTemplate(LynxLoadMeta)` and `LynxLoadMeta.Builder` — **compiled, with a fix**: the setters return `void` in 4.1.0, so `setUrl`/`setGlobalProps` are called on a builder variable and not chained. Rendering a bundle is unverified (`AwcmsLynxHost.kt`).
4. `JavaOnlyArray.of(...)` — **compiled** (`AwcmsLynxHost.kt`); delivery of the deep-link event to the bundle is unverified.
5. `AbsTemplateProvider.Callback.onSuccess/onFailed` signatures — **compiled** (`AwcmsLynxHost.kt`).
6. The androidx.security deprecation wording — **not verifiable by a build** (the library is deliberately not a dependency; `KeystoreSecureStore.kt`).

Also verified by the build: the manifest and backup/data-extraction rules merge and lint without errors, and
the debug APK contains `assets/main.lynx.bundle`. Not verified: any run on a device or emulator, the Keystore
store, instrumented tests, release/R8 builds, signing.
