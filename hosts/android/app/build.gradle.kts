import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Placeholder identity: rename in a derived product (README.md "Make it yours").
// Versions below are the ones the build was verified with (ADR-0006).
val lynxVersion = "4.1.0"
val primjsVersion = "4.1.1"
val frescoVersion = "2.3.0"

// Stages the top-level *.kt files of hosts/android as a source root. A plain srcDir(rootDir)
// would also pull in app/ and build output.
val syncHostSources by tasks.registering(Sync::class) {
    description = "Stages the reference host sources (hosts/android/*.kt) for compilation."
    from(rootDir) { include("*.kt") }
    into(layout.buildDirectory.dir("generated/hostSources"))
}

android {
    namespace = "id.ahliweb.awcms.lynx"
    compileSdk = 36

    defaultConfig {
        applicationId = "id.ahliweb.awcms.lynx"
        minSdk = 24 // Keystore AES-GCM needs >= 23; Lynx 4.1 supports 24+
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // Per-flavour defaults of the runtime config; never secrets (they are readable by the bundle).
        buildConfigField("String", "AWCMS_API_BASE_URL", "\"https://api.example.invalid\"")
        buildConfigField("String", "AWCMS_STOREFRONT_ORIGIN", "\"https://app.example.invalid\"")
    }

    buildFeatures { buildConfig = true }

    buildTypes {
        release {
            // R8 stays off until the Lynx keep block is added to proguard-rules.pro and a
            // release build is run on a device (hosts/android/README.md, "Release builds").
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The reference host sources live one directory up (hosts/android/*.kt) and are the
    // compiled sources (staged by syncHostSources below); this module adds only the
    // Application, the Activity and resources.
    sourceSets.getByName("main").kotlin.srcDir(layout.buildDirectory.dir("generated/hostSources"))
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/lynxBundle"))

    testOptions {
        unitTests.all {
            it.systemProperty(
                "awcms.contractVectors",
                rootDir.resolve("../contract-test-vectors.json").canonicalPath,
            )
        }
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

// Copies the Lynx bundle built by `bun run build:mobile` into the APK assets.
// A missing bundle fails the build with an explicit message, so an APK can never be
// assembled without it.
val bundleSource = rootDir.resolve("../../apps/mobile/dist/main.lynx.bundle")
val bundleAssetsDir = layout.buildDirectory.dir("generated/lynxBundle")

val checkLynxBundle by tasks.registering {
    description = "Fails with a clear message when the Lynx bundle has not been built."
    // A task with no inputs/outputs always runs (a Sync with a missing source would be NO-SOURCE).
    doLast {
        check(bundleSource.isFile) {
            "Missing ${bundleSource.path}. Run `bun run build:mobile` at the repository root first."
        }
    }
}

val copyLynxBundle by tasks.registering(Sync::class) {
    description = "Copies apps/mobile/dist/main.lynx.bundle into the APK assets."
    dependsOn(checkLynxBundle)
    from(bundleSource)
    into(bundleAssetsDir)
}

dependencies {
    implementation("org.lynxsdk.lynx:lynx:$lynxVersion")
    implementation("org.lynxsdk.lynx:lynx-jssdk:$lynxVersion")
    implementation("org.lynxsdk.lynx:lynx-trace:$lynxVersion")
    implementation("org.lynxsdk.lynx:primjs:$primjsVersion")
    implementation("org.lynxsdk.lynx:lynx-service-image:$lynxVersion")
    implementation("com.facebook.fresco:fresco:$frescoVersion")
    implementation("com.facebook.fresco:animated-gif:$frescoVersion")
    implementation("com.facebook.fresco:animated-webp:$frescoVersion")
    implementation("com.facebook.fresco:webpsupport:$frescoVersion")
    implementation("com.facebook.fresco:animated-base:$frescoVersion")
    implementation("org.lynxsdk.lynx:lynx-service-log:$lynxVersion")
    implementation("org.lynxsdk.lynx:lynx-service-http:$lynxVersion")
    implementation("com.squareup.okhttp3:okhttp:4.9.0")
    implementation("org.lynxsdk.lynx:xelement:$lynxVersion")
    implementation("org.lynxsdk.lynx:xelement-input:$lynxVersion")

    // Devtool only in debug builds (QR-code / inspector), never shipped to users.
    debugImplementation("org.lynxsdk.lynx:lynx-devtool:$lynxVersion")
    debugImplementation("org.lynxsdk.lynx:lynx-service-devtool:$lynxVersion")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // org.json is stubbed in JVM unit tests
}

// Compile, lint and packaging read the staged host sources and the bundle, so stage them first.
// A missing bundle therefore fails every Gradle build with the explicit message above.
tasks.named("preBuild") { dependsOn(syncHostSources, copyLynxBundle) }
