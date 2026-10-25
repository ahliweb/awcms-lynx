🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](status.md)

# Status — apa yang telah diverifikasi, per target

Terakhir diperbarui 25 Oktober 2026. "Terverifikasi" berarti telah dijalankan di lingkungan repositori ini (Linux, Bun 1.4.4, Node 22.22) atau CI; selebihnya diberi label. Sebuah produk turunan menyalin halaman ini dan mengisi hasil PoC-nya sendiri (awcms-one ADR-0050 D6, awcms ADR-0146 §5).

## Blok penyusun

| Komponen | Status | Bukti |
| --- | --- | --- |
| `@awcms-lynx/client` (kedua profil backend) | Terverifikasi lewat unit test terhadap kontrak yang terdokumentasi; **belum** dijalankan terhadap backend live di sini | `bun test packages/client` (119 test) |
| Kontrak `@awcms-lynx/platform`, bridge, konfigurasi runtime | Terverifikasi | `bun test packages/platform` |
| Host JS terhadap 74 vektor kontrak | Terverifikasi (host web dan desktop) | `tests/contract-vectors.test.ts` |
| UI `@awcms-lynx/app` (kedua profil) | Terverifikasi di test renderer ReactLynx | `bun run test:ui` |
| Kebijakan repositori (tanpa API runtime terlarang, tanpa secret, indeks ADR, mirror, tautan) | Terverifikasi | `tests/repo-policy.test.ts` |

## Target

| Target | Build | Dijalankan | Belum diverifikasi |
| --- | --- | --- | --- |
| Lynx bundle (`main.lynx.bundle`) | ✅ `bun run build:mobile` | ✅ dimuat oleh runtime Lynxtron sungguhan (headless) | pada perangkat di Lynx Explorer |
| Web (`main.web.bundle` + `apps/web`) | ✅ `bun run build` | ✅ Chromium di bawah CSP production: UI berhasil dirender, host bridge merespons | Safari, Firefox; Caddy/nginx sungguhan; backend live di balik proxy |
| Desktop (Lynxtron, macOS/Windows) | ✅ `bun run build:desktop` | ✅ run Lynxtron headless di Linux menjawab `app.info`/`secureStorage` | run dengan jendela, `dev`, `pack`, signing — membutuhkan macOS/Windows |
| Host Android | ⬜ sumber referensi | ⬜ | kompilasi terhadap versi Lynx yang di-pin, vektor di JUnit, run di perangkat (daftar VERIFY di `hosts/android/README.md`) |
| Host iOS | ⬜ sumber referensi | ⬜ | sama, dengan XCTest (`hosts/ios/README.md`) |
| Host HarmonyOS | ⬜ sumber referensi | ⬜ | sama, dengan hypium (`hosts/harmony/README.md`); ketidakpastian paling besar |

## Batasan yang diketahui

- **Versi Lynx.** Paket JS: `@lynx-js/react` 0.129.0, `@lynx-js/rspeedy` 0.18.3, `@lynx-js/web-core` 0.26.5, Lynxtron 0.0.30. Sampel native resmi mem-pin Lynx 3.8.x (Android/Harmony) sementara dokumentasi dan Explorer berada di 4.x; sebuah produk memilih satu versi engine untuk semua host native.
- **Penyimpanan session**: hanya didukung hardware pada host native (setelah dikompilasi); desktop menggunakan file khusus pemilik (`app-file`, Lynxtron 0.0.30 tidak memiliki API keyring); Web menggunakan penyimpanan browser.
- **Celah backend** yang membuat aplikasi persona tetap berada pada tingkat PoC dicantumkan di [`backend-integration.md`](backend-integration.md#gaps).
- **Tidak termasuk di v1**: deep link, pengambilan push token, kamera/lokasi/barcode, cache offline — masing-masing memerlukan kenaikan host-contract (konsekuensi ADR-0003).
