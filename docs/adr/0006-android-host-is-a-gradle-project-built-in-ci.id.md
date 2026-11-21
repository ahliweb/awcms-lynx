🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](0006-android-host-is-a-gradle-project-built-in-ci.md)

# ADR-0006 — Host Android adalah proyek Gradle yang di-build, di-lint, dan diuji unit oleh CI

- **Status:** Diusulkan (keputusan dicatat bersama pull request yang menutup issue #24; menjadi Diterima saat pull request itu di-merge oleh maintainer)
- **Tanggal:** 21 November 2026
- **Pengambil keputusan:** maintainer ahliweb (review pull request)
- **Terkait:** ADR-0002, ADR-0003, ADR-0004; `hosts/android/README.md`; STATUS di `hosts/README.md`; issue #24

## Konteks

Sampai sekarang `hosts/android` hanya berisi sumber Kotlin referensi yang tidak dikompilasi oleh job CI mana pun. Sebuah build spike downstream (2026-11-21) mengompilasinya terhadap Lynx 4.1.0 dan menemukan satu error nyata: setter `LynxLoadMeta.Builder` mengembalikan `void` di 4.1.0, sehingga pemanggilan berantai di `AwcmsLynxHost.createView` tidak dapat dikompilasi. Sumber referensi yang tidak pernah di-build menyimpang diam-diam; ini penyimpangan pertama yang ditemukan. Spike itu juga menetapkan versi toolchain yang bekerja bersama (di bawah). Template membutuhkan host Android yang dapat di-build agar produk turunan mulai dari build hijau, dan agar kontrak host (ADR-0003) diputar ulang di JVM, bukan hanya di host web dan desktop.

## Keputusan

**D1. Proyek Gradle minimal (Kotlin DSL) berada di `hosts/android`.** File root `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar` yang dibuat oleh distribusi resmi Gradle 8.13, `distributionSha256Sum` dan `validateDistributionUrl=true` di properties), dan satu modul `app` (`id.ahliweb.awcms.lynx`, application id placeholder) berisi `App`, `MainActivity`, manifest, serta aturan backup dan data-extraction.

**D2. Versi di-pin dan telah diverifikasi bersama:** Lynx 4.1.0, PrimJS 4.1.1, Android Gradle Plugin 8.9.1, Gradle 8.13, Kotlin 2.0.21, Fresco 2.3.0, OkHttp 4.9.0; JDK 21 menjalankan build dan kode menarget Java 17; `compileSdk`/`targetSdk` 36, `minSdk` 24.

**D3. Sumber referensi yang ada tetap menjadi sumber yang dikompilasi.** File `hosts/android/*.kt` di-stage oleh task `Sync` ke source root hasil generate; `app` hanya menambah Application, Activity, dan resource. Bundle `apps/mobile/dist/main.lynx.bundle` disalin ke assets APK oleh task Gradle yang gagal dengan pesan jelas bila bundle tidak ada. Pemanggilan `LynxLoadMeta` diperbaiki dengan variabel builder.

**D4. CI mendapat job `android` terpisah** di `.github/workflows/ci.yml`: Bun membangun bundle, JDK 21 (Temurin) dan Android SDK dari image runner membangun APK, `gradle/actions/wrapper-validation` menolak wrapper jar tidak resmi, lalu `./gradlew assembleDebug lintDebug testDebugUnitTest` berjalan. Action pihak ketiga pada job baru di-pin dengan commit SHA.

**D5. Kontrak host diputar ulang di JVM.** Tes JUnit 4 berparameter menjalankan setiap kasus `hosts/contract-test-vectors.json` terhadap `HostBridgeDispatcher` (satu tes per kasus) ditambah dua tes kegagalan untuk kasus yang oleh vektor dicatat sebagai belum tercakup (`STORAGE_UNAVAILABLE`, `HOST_ERROR`). Store Keystore asli dan adapter modul Lynx tidak tercakup; keduanya membutuhkan perangkat.

**D6. Devtool hanya dependensi `debugImplementation`,** sehingga APK release tidak membawa kelas devtool. Mendaftarkan layanan devtool tetap langkah terdokumentasi di sisi produk (`hosts/android/README.md` §3). R8 tetap mati di release sampai blok keep Lynx ditambahkan dan build release dijalankan di perangkat.

## Opsi yang dibandingkan

| Kriteria | A. Proyek Gradle di `hosts/android` + job CI (dipilih) | B. Pertahankan sumber referensi, build hanya di downstream | C. Proyek Gradle, di-build di dalam job `check` yang ada |
| --- | --- | --- | --- |
| Kelebihan dan kekurangan | Penyimpangan ketahuan di CI, produk turunan mulai dari hijau; menambah file dan toolchain untuk dirawat | Tanpa perawatan di sini; bug di atas tetap ada dan setiap produk menemukannya lagi | Satu job; kegagalan toolchain Android memblokir pemeriksaan JS dan seluruh job melambat |
| Keamanan | Checksum wrapper dan action validasi menjaga rantai pasok; action di-pin SHA; tanpa secret; hanya keystore debug | Tidak ada permukaan baru di sini; dependensi Android tidak ditinjau | Sama dengan A |
| Performa | Job berjalan paralel dengan `check`; cache Gradle di main | Tidak ada | Waktu CI adalah jumlahnya |
| Maintainability | Kenaikan versi (Lynx, AGP, Kotlin) satu PR dengan sinyal hijau | Versi menyimpang antarproduk | Sama dengan A, kegagalan lebih berisik |
| Skalabilitas | Pola sama dapat dipakai job iOS atau Harmony nanti | Tidak skala untuk lebih banyak host | Buruk: satu job menumpuk toolchain |
| Aksesibilitas | UI tidak berubah; lint menjalankan pemeriksaan aksesibilitas Android pada shell host | Tidak ada | Sama dengan A |
| SEO | Tidak berlaku | Tidak berlaku | Tidak berlaku |
| UI/UX | Hanya shell host (menjalankan bundle yang sama) | Tidak ada | Sama dengan A |
| Kompatibilitas | Kombinasi versi terverifikasi; Lynx 4.1.0 sesuai dokumen paket JS | Tidak terverifikasi pada versi Lynx mana pun | Sama dengan A |
| Kompleksitas operasional | Satu job tambahan, satu wrapper jar di repositori | Tidak ada di sini, lebih banyak di downstream | Satu job dengan dua runtime plus JDK dan SDK |
| Jangka panjang | Status jujur ("dikompilasi dan diuji unit di CI"); run di perangkat tetap PoC produk | Status tetap "hanya referensi" | Sama dengan A dengan keterikatan |

## Konsekuensi

- `hosts/android` dapat di-build: `bun run build:mobile` lalu `./gradlew assembleDebug lintDebug testDebugUnitTest` di direktori itu (butuh Android SDK; set `ANDROID_HOME` atau `local.properties`).
- Status Android berpindah dari "sumber referensi" ke "build, lint, dan lolos 74 vektor kontrak di JUnit di CI". Tidak ada klaim run di perangkat, tes instrumented, build release, signing, maupun run R8.
- Mengganti application id dan namespace adalah langkah pertama produk turunan.
- Versi baru Lynx, AGP, Gradle, atau Kotlin adalah perubahan sengaja atas D2 dan menjalankan ulang job; daftar `VERIFY` di `hosts/android/README.md` mencatat apa yang dikonfirmasi dan tidak oleh build.
- Menaikkan wrapper mengganti `gradle-wrapper.jar` dan `distributionSha256Sum` bersamaan; langkah wrapper-validation harus tetap hijau.
