🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](development.md)

# Alur kerja pengembangan

## Penyiapan

```bash
bun install                       # Bun 1.4.4+, Node 22.18+ also required (ADR-0002)
cp .env.example apps/mobile/.env  # and apps/web/.env, apps/desktop/.env as needed
```

Arahkan `PUBLIC_AWCMS_API_BASE_URL` ke backend yang Anda jalankan secara lokal: `ahliweb/awcms` (`bun run dev`, port 4321) atau `ahliweb/awcms-one` (`bun run db:up && bun run --cwd apps/cms dev`, ditambah storefront untuk indeks katalog). Pada emulator Android, alamat mesin host adalah `10.0.2.2`; pada ponsel fisik gunakan IP LAN mesin (http hanya diterima untuk alamat loopback dan LAN privat).

## Alur harian

| Tujuan | Perintah |
| --- | --- |
| Ponsel (Explorer) dengan hot reload | `bun run dev`, pindai kode QR |
| Peramban | `bun run build:mobile && bun run dev:web` |
| Desktop | `bun run dev:desktop` |
| Semua gerbang sebelum push | `bun run check` |
| Perbaikan otomatis lint | `bunx biome check --write .` |

Lakukan debug dengan [Lynx DevTool](https://github.com/lynx-family/lynx-devtool/releases) (USB ke perangkat) atau `npx agent-lynx` untuk inspeksi terskrip.

## Lokasi setiap perubahan

| Perubahan | Lokasi | Perbarui juga |
| --- | --- | --- |
| Layar atau komponen baru | `packages/app/src/` | string di kedua locale, pengujian UI, `docs/ui-guidelines.md` jika polanya baru |
| Panggilan backend baru | `packages/client/src/awcms.ts` atau `commerce.ts` | pengujian klien, `docs/backend-integration.md` |
| Kapabilitas host baru | `packages/platform/src/contract.ts` + setiap host | `HOST_BRIDGE_VERSION`, `hosts/contract-test-vectors.json`, konsekuensi ADR-0003 |
| Kunci konfigurasi baru | `packages/platform/src/runtime-config.ts` | `.env.example`, `apps/mobile/src/build-env.ts`, `env.d.ts`, host web/desktop |
| Keputusan dengan trade-off | `docs/adr/NNNN-*.md` | indeks `docs/adr/README.md` |

## Pull request

- Satu perubahan atomik yang dapat diverifikasi secara mandiri per PR; buat cabang dari `main`.
- `bun run check` hijau secara lokal dan di CI.
- Changeset di bawah `.changesets/` ketika perilaku publik, struktur, dependensi, atau deployment berubah ([`.changesets/README.md`](../.changesets/README.md)).
- Dokumentasi diperbarui dalam PR yang sama; mirror Bahasa Indonesia (`*.id.md`) diperbarui bersama sumber bahasa Inggrisnya.
- Pesan commit: prefiks konvensional (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`) dan *alasannya* di badan pesan.

## Rilis

`bun run release` menampilkan pratinjau versi berikutnya dari changeset yang tertunda; `bun run release --apply --tag` menggabungkannya ke `CHANGELOG.md`, menaikkan versi setiap workspace, dan memberi tag `vX.Y.Z`. Push commit dan tag-nya.
