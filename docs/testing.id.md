🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](testing.md)

# Pengujian

| Lapisan | Runner | Lokasi | Perintah |
| --- | --- | --- | --- |
| Klien API | `bun test` | `packages/client/src/__tests__/` | `bun test packages/client` |
| Kontrak host, konfigurasi runtime, handler host web | `bun test` | `packages/platform/src/__tests__/` | `bun test packages/platform` |
| Kebijakan repositori, changeset, versi | `bun test` | `tests/` | `bun test tests` |
| UI ReactLynx (kedua profil backend, kejujuran pengaturan, galat konfigurasi) | Rstest + `@lynx-js/react/testing-library` | `apps/mobile/src/__tests__/` | `bun run test:ui` |
| Bundle | Rspeedy / Rsbuild | `apps/mobile`, `apps/web`, `apps/desktop` | `bun run build`, `bun run build:desktop` |
| Kontrak host native | pengujian unit platform (di dalam produk) | putar ulang `hosts/contract-test-vectors.json` | sesuai `hosts/README.md` |

`bun run check` menjalankan lint, type-check, `bun test`, pengujian UI, dan build — langkah yang sama dengan `.github/workflows/ci.yml`.

## Konvensi

- **Tanpa jaringan dalam pengujian.** Klien menerima `fetch` melalui injeksi; pengujian memberikan fake yang menjawab berdasarkan URL dan mencatat permintaan.
- **Uji kontraknya, bukan implementasinya.** Pengujian klien memverifikasi path, header (`X-AWCMS-Tenant-ID` ada pada rute staf, tidak ada pada rute commerce), body, serta hasil dan galat yang bertipe tepat.
- **Pengujian UI memakai klien sungguhan** di atas `fetch` palsu dan host bridge di memori, sehingga pengujian layar sekaligus membuktikan penyambungannya.
- **Setiap fakta backend memiliki pengujian.** Ketika kontrak backend berubah, pengujian yang gagal menjadi pengingat untuk memperbarui `docs/backend-integration.md`.
- Bug yang ditemukan oleh pengujian diperbaiki di kode, tidak pernah dengan melonggarkan asersi (run UI pertama menemukan `health()` keliru ditolak pada profil `awcms-one`).

## Yang tidak dapat diuji CI

Build perangkat (Xcode, Gradle, DevEco), penyimpanan aman yang sesungguhnya, push, kamera, dan pembaca layar memerlukan perangkat. Semuanya menjadi gerbang PoC per produk (awcms-one ADR-0050 D6, awcms ADR-0146 §5); [`status.md`](status.md) mencatat mana yang sudah dijalankan.
