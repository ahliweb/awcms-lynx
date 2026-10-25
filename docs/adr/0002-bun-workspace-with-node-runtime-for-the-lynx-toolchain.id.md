🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](0002-bun-workspace-with-node-runtime-for-the-lynx-toolchain.md)

# ADR-0002 — Bun mengelola workspace; Node.js menjalankan toolchain Lynx

- **Status:** Diterima
- **Tanggal:** 25 Oktober 2026
- **Pengambil keputusan:** ahliweb
- **Terkait:** ADR-0001; awcms ADR-0146 §2.6 (Bun-only berlaku untuk repositori AWCMS; dukungan Bun untuk Lynx harus diverifikasi di repositori konsumen); awcms-one ADR-0050 D7

## Konteks

Keluarga AWCMS menggunakan Bun saja. Tooling resmi Lynx menyatakan persyaratan Node.js: Rspeedy/`create-lynx` membutuhkan Node 20.19+ atau 22.12+, sedangkan Lynxtron membutuhkan `^22.18.0 || ^24 || ^26` (lynx-family/lynx-website `docs/en/guide/start/quick-start.mdx`, `docs/en/lynxtron/introduction.mdx`). ADR-0146 meminta repositori konsumen untuk memverifikasi apakah Bun dapat digunakan.

Diverifikasi di repositori ini pada 25 Oktober 2026 dengan Bun 1.4.4 dan Node 22.22: `bun install` menyelesaikan paket-paket Lynx dengan isolated linker milik Bun; `bun run build` menjalankan `rspeedy build`, yang binary-nya dieksekusi di bawah Node, dan menghasilkan `main.lynx.bundle` serta `main.web.bundle`; `rstest` menjalankan ReactLynx testing library; `bun test` menjalankan paket TypeScript murni.

## Keputusan

**D1.** Bun adalah package manager, lockfile (`bun.lock`), dan script runner. Tidak ada `package-lock.json`, `pnpm-lock.yaml`, atau `yarn.lock` yang di-commit.

**D2.** Node.js `^22.18.0 || ^24 || ^26` harus terpasang bersama Bun, karena Rspeedy, Rsbuild, Rstest, dan Lynxtron dieksekusi di bawah Node. `engines` mendeklarasikan keduanya; `.nvmrc` mematok 22.18. Ini adalah "pengecualian yang disetujui maintainer" dari ADR-0146 §2.6: Node adalah *runtime untuk build tool pihak ketiga*, bukan package manager kedua atau runtime untuk kode yang kami kirimkan.

**D3.** Kode yang kami tulis diuji dengan runner yang sesuai dengan tempat kode itu berjalan: TypeScript murni (`packages/client`, `packages/platform`, `tests/`) dengan `bun test`; komponen ReactLynx dengan Rstest + `@lynx-js/react/testing-library` (jalur resmi Lynx).

## Opsi yang dipertimbangkan

| Kriteria | Bun + runtime Node (dipilih) | Node + pnpm (default upstream Lynx) | Bun saja (`bun --bun`) |
| --- | --- | --- | --- |
| Keamanan | Satu lockfile, pemeriksaan integritas Bun | Lockfile berbeda dari keluarga | Runtime untuk bundler belum teruji |
| Performa | Instalasi cepat; kecepatan build tetap ditentukan oleh Rspack | Kecepatan build sama | Tidak diketahui |
| Maintainability | Perintah sama dengan awcms/awcms-one | Package manager kedua yang harus dipelajari | Gagal pada API khusus Node di Rspeedy/Lynxtron |
| Kompatibilitas | Sesuai dengan kebutuhan runtime upstream | Paling sesuai dengan upstream | Tidak didukung upstream |
| Kompleksitas operasional | Dua runtime di CI dan mesin pengembang | Dua runtime juga untuk pengembang keluarga | Satu runtime tetapi rapuh |
| Jangka panjang | Menghapus Node saat upstream mendukung Bun | Menyimpang dari keluarga | Berisiko |

## Konsekuensi

- CI memasang Bun dan Node (`.github/workflows/ci.yml`).
- Jika rilis Rspeedy/Lynxtron di masa depan mendukung Bun sebagai runtime, D2 ditinjau ulang melalui ADR baru.
