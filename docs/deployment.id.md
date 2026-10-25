🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](deployment.md)

# Deployment

Satu sumber, enam target yang dapat dikirim. Setiap target terdiri dari **host** dan bundle yang dimuatnya; backend di-deploy secara terpisah oleh produk turunan (ADR-0001 D2). Lakukan build bundle terlebih dahulu: `bun run build:mobile` → `apps/mobile/dist/main.lynx.bundle`, `apps/mobile/dist/main.web.bundle`.

## Konfigurasi per lingkungan

`PUBLIC_AWCMS_*` (`.env.example`) disisipkan langsung ke dalam kode pada saat build; host dapat menimpa kunci yang sama saat runtime melalui `globalProps` Lynx. Penyiapan yang umum: satu bundle per lingkungan (development, staging, production) yang di-build dengan `.env.<mode>`, atau satu bundle dengan host yang meneruskan `apiBaseUrl` untuk lingkungan tersebut. Tidak ada secret yang dimasukkan ke dalam keduanya.

## Target

| Target | Host | Artifact | Langkah | Detail |
| --- | --- | --- | --- | --- |
| Android | `hosts/android` (Kotlin, LynxView) | APK / AAB dengan `main.lynx.bundle` di assets | adopsi host ke dalam proyek Android yang dibuat dari `lynx-family/integrating-lynx-demo-projects`, salin bundle ke `assets/`, lakukan signing, unggah ke Play | [`hosts/android/README.md`](../hosts/android/README.md) |
| iOS | `hosts/ios` (Swift, LynxView via CocoaPods) | IPA dengan bundle sebagai resource | sama, dari proyek demo Swift; signing, App Store Connect | [`hosts/ios/README.md`](../hosts/ios/README.md) |
| HarmonyOS | `hosts/harmony` (ArkTS) | HAP dengan bundle di `rawfile` | sama, dari proyek demo Harmony; signing DevEco, AppGallery | [`hosts/harmony/README.md`](../hosts/harmony/README.md) |
| Web | `apps/web` (`<lynx-view>`) | file statis `apps/web/dist/` | `bun run build`; sajikan di balik reverse proxy yang meneruskan `/api` dan `/feed.json` ke backend, dengan CSP dan header di `apps/web/deploy/` | [`apps/web/README.md`](../apps/web/README.md) |
| macOS | `apps/desktop` (Lynxtron) | `.dmg` / `.zip` | `bun run build:desktop`, `bun run --cwd apps/desktop pack` di Mac; signing Developer ID dan notarisasi | [`apps/desktop/README.md`](../apps/desktop/README.md) |
| Windows | `apps/desktop` (Lynxtron) | installer NSIS | sama di Windows; signing Authenticode | [`apps/desktop/README.md`](../apps/desktop/README.md) |
| Pengembangan di ponsel | Lynx Explorer | URL dev-server | `bun run dev`, pindai kode QR | [Panduan cepat Lynx](https://lynxjs.org/guide/start/quick-start.html) |

Lynx Explorer adalah sandbox khusus untuk pengembangan: ia tidak memiliki `AwcmsHostBridge`, sehingga session hanya tersimpan di memori dan layar Settings menyatakan hal tersebut.

## Kekhususan Web

- **Origin yang sama.** Rute staf awcms tidak memiliki CORS; rute commerce awcms-one hanya menerima domain tenant yang terdaftar. Sajikan aplikasi web pada origin yang Anda konfigurasikan sebagai `PUBLIC_AWCMS_API_BASE_URL` dan proxy `/api/*` serta `/feed.json` ke backend (`apps/web/deploy/Caddyfile.example`, `nginx.conf.example`).
- **CSP.** Lynx for Web memerlukan `'unsafe-eval'`, `blob:`, dan satu hash `sha256-` yang terikat pada `@lynx-js/web-core` 0.26.5; hitung ulang hash tersebut saat web-core ditingkatkan. Jika indeks storefront berada di origin lain, tambahkan origin tersebut ke `connect-src`.
- **Caching.** `static/**` menggunakan content hash (`immutable`); `index.html` dan `*.bundle` memiliki nama yang stabil (`no-cache`).
- **SEO.** App shell mengirim `noindex, nofollow`: aplikasi persona bukan permukaan pencarian, SEO publik tetap berada pada situs Astro (awcms ADR-0146).

## Prasyarat backend

| Profil | Backend harus… |
| --- | --- |
| `awcms` | menyediakan `/api/v1` melalui https; untuk sign-in native, jalankan login tanpa Turnstile (profil LAN/offline) atau sediakan desain auth yang mendukung native (`docs/backend-integration.md` §Gaps) |
| `awcms-one` | melakukan resolusi tenant untuk request tanpa `Origin` (`PUBLIC_TENANT_RESOLUTION_MODE=host_default` atau `PUBLIC_DEFAULT_TENANT_ID`), atau aplikasi mengatur `originHeader`; menyajikan indeks statis storefront untuk katalog; mendaftarkan domain aplikasi web sebagai domain tenant jika tidak disajikan pada origin yang sama |

## Checklist release (per produk)

- [ ] App id, nama, dan ikon sudah diganti (placeholder `id.ahliweb.awcms.lynx`).
- [ ] `PUBLIC_AWCMS_API_BASE_URL` untuk production harus https; pengecualian cleartext/ATS hanya ada di build debug.
- [ ] Hasil PoC dicatat per target di `docs/status.md` milik produk (build, penyimpanan aman, sign-in/out, aksesibilitas dengan screen reader, performa pada perangkat kelas bawah, perilaku offline).
- [ ] Signing sudah dikonfigurasi; build release hanya memuat bundle yang dikemas (tanpa URL dev-server).
- [ ] `bun run check` berhasil; versi diberi tag dari changeset.
