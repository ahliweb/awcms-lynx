🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](README.md)

# awcms-lynx

Template **klien aplikasi LynxJS / ReactLynx** keluarga AWCMS: satu basis kode ReactLynx, dirender secara native di **iOS, Android dan HarmonyOS**, di browser melalui **Lynx for Web**, dan di **macOS dan Windows** melalui **Lynxtron** — semuanya berkomunikasi dengan backend [`ahliweb/awcms`](https://github.com/ahliweb/awcms) atau [`ahliweb/awcms-one`](https://github.com/ahliweb/awcms-one) melalui HTTP API yang terdokumentasi.

Repositori ini adalah "repositori aplikasi persona terpisah" yang diminta oleh awcms ADR-0146 dan awcms-one ADR-0050: backend tetap bebas dari Lynx, dan sebuah produk turunan dimulai dari sini, bukan dari proyek `create-lynx` yang kosong ([ADR-0001](docs/adr/0001-awcms-lynx-is-the-persona-app-template-repository.md)).

> **Status:** fondasi template. Klien API, kontrak host, UI bersama, bundle Lynx dan Web, host Web, serta host desktop dapat dibangun dan diuji di CI; host native di bawah `hosts/` merupakan sumber referensi yang akan dikompilasi oleh produk turunan dalam proof of concept (PoC) masing-masing. [`docs/status.md`](docs/status.md) mencantumkan apa yang telah diverifikasi untuk setiap target.

## Yang Anda dapatkan

| Path | Deskripsi |
| --- | --- |
| `packages/client` | `@awcms-lynx/client` — klien HTTP bertipe untuk kedua backend: envelope, error, correlation id, idempotency, header tenant, sign-in staf (kata sandi, MFA, pemilihan workspace) dan sesi kode satu kali pelanggan, serta pemformatan uang tanpa `Intl`. Berjalan di dalam background thread Lynx. |
| `packages/platform` | `@awcms-lynx/platform` — kontrak host-bridge yang diimplementasikan oleh setiap host ([ADR-0003](docs/adr/0003-one-host-bridge-contract-for-every-lynx-host.md)), adapter untuk background thread-nya, konfigurasi runtime, dan handler sisi browser untuk host. |
| `packages/app` | `@awcms-lynx/app` — aplikasi ReactLynx bersama: layar, komponen, string bahasa Inggris dan Indonesia, design token, `startApp()`. |
| `apps/mobile` | Build Rspeedy dari aplikasi: `dist/main.lynx.bundle` (iOS, Android, HarmonyOS, Lynx Explorer) dan `dist/main.web.bundle` (Lynx for Web). |
| `apps/web` | Halaman browser yang memasang `<lynx-view>` dan merespons host bridge; contoh deploy untuk Caddy dan nginx. |
| `apps/desktop` | Host Lynxtron untuk macOS dan Windows. |
| `hosts/` | Host native referensi — Android (Kotlin), iOS (Swift), HarmonyOS (ArkTS) — yang mengimplementasikan kontrak yang sama dengan Keystore, Keychain dan HUKS. |
| `docs/` | Arsitektur, integrasi backend, keamanan, panduan UI, pengujian, deployment, alur kerja pengembangan, ADR. |

## Dua profil backend

| `PUBLIC_AWCMS_BACKEND` | Backend | Persona | Tab |
| --- | --- | --- | --- |
| `awcms` | ahliweb/awcms | staf, anggota, petugas lapangan | Beranda (kesehatan + JSON Feed), Pencarian (pencarian situs), Akun (masuk, sesi, keluar), Pengaturan |
| `awcms-one` (default) | ahliweb/awcms-one | pelanggan | Beranda (kesehatan + berita storefront), Katalog (indeks produk storefront), Akun (kode satu kali, pesanan, keluar), Pengaturan |

## Mulai cepat

Prasyarat: [Bun](https://bun.sh) 1.4.4+ **dan** [Node.js](https://nodejs.org) 22.18+ (toolchain Lynx berjalan di atas Node — [ADR-0002](docs/adr/0002-bun-workspace-with-node-runtime-for-the-lynx-toolchain.md)).

```bash
bun install
cp .env.example apps/mobile/.env      # arahkan PUBLIC_AWCMS_* ke backend Anda
bun run dev                           # server pengembangan Rspeedy + kode QR
```

Pindai kode QR dengan **Lynx Explorer** (APK Android, simulator iOS, simulator HarmonyOS — lihat [Lynx quick start](https://lynxjs.org/guide/start/quick-start.html)), atau tempelkan URL bundle ke "Enter Card URL" di Explorer.

| Target | Pengembangan | Build |
| --- | --- | --- |
| iOS / Android / HarmonyOS (Explorer) | `bun run dev` | `bun run build:mobile` → `apps/mobile/dist/main.lynx.bundle` |
| Web | `bun run build:mobile && bun run dev:web` | `bun run build` → `apps/web/dist/` |
| macOS / Windows | `bun run dev:desktop` | `bun run build:desktop`, lalu `bun run --cwd apps/desktop pack` |
| Aplikasi native rilis | sematkan `main.lynx.bundle` dalam host dari `hosts/` | sesuai dengan [`hosts/README.md`](hosts/README.md) |

Semua yang harus lolos di pull request: `bun run check` (lint, type-check, unit test, UI test, build).

## Memulai produk dari template ini

1. **Use this template** di GitHub; repositori baru memiliki salinannya sepenuhnya ([ADR-0001](docs/adr/0001-awcms-lynx-is-the-persona-app-template-repository.md) D4).
2. Pilih profil backend dan atur `PUBLIC_AWCMS_*` untuk setiap environment (`.env.example`).
3. Ganti nama app id (`id.ahliweb.awcms.lynx`) di `apps/desktop` dan di host yang Anda adopsi dari `hosts/`.
4. Jalankan gerbang proof of concept (awcms-one ADR-0050 D6 / awcms ADR-0146 §5) untuk setiap target yang akan Anda rilis, dan catat hasilnya di `docs/status.md` milik Anda sendiri.
5. Ajukan celah backend yang Anda temui (autentikasi staf yang mendukung native, refresh, push pelanggan…) sebagai issue API di repositori backend — [`docs/backend-integration.md`](docs/backend-integration.md#gaps).

## Dokumentasi

Mulai dari [`docs/README.md`](docs/README.md). Aturan kerja bagi manusia dan agen AI: [`AGENTS.md`](AGENTS.md).

## Lisensi

[MIT](LICENSE). Sebagian diadaptasi dari template dan contoh Lynx (Apache-2.0) — lihat [`NOTICE`](NOTICE).
