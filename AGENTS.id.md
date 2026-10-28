🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](AGENTS.md)

# AGENTS.md — kontrak kerja awcms-lynx

Berlaku bagi manusia maupun agen AI. Baca terlebih dahulu sebelum mengubah apa pun.

## Apa itu repositori ini

Template **klien** LynxJS/ReactLynx keluarga AWCMS ([ADR-0001](docs/adr/0001-awcms-lynx-is-the-persona-app-template-repository.md)). Repositori ini tidak memiliki backend, basis data, atau secret. Repositori ini berkomunikasi dengan instans `ahliweb/awcms` (profil `awcms`, staf) atau `ahliweb/awcms-one` (profil `awcms-one`, pelanggan) melalui API yang terdokumentasi di [`docs/backend-integration.md`](docs/backend-integration.md).

Sebelum mengerjakan tugas Lynx apa pun, baca indeks Lynx: <https://lynxjs.org/llms.txt> (titik masuk resmi bagi agen), lalu [`docs/lynx-runtime.md`](docs/lynx-runtime.md) untuk fakta-fakta yang bergantung pada repositori ini.

## Perintah

| Perintah | Keterangan |
| --- | --- |
| `bun install` | instal (Bun 1.4.4+; Node 22.18+ juga harus terpasang — ADR-0002) |
| `bun run dev` / `dev:web` / `dev:desktop` | jalankan pengembangan di Explorer / browser / desktop |
| `bun run check` | lint + type-check + `bun test` + UI test + build — harus hijau sebelum PR |
| `bun test` | tes TypeScript murni (client, platform, TypeScript host, `tests/`) |
| `bun run test:ui` | tes ReactLynx (Rstest) |
| `bun run release` | pratinjau versi berikutnya dari `.changesets/` |

## Aturan yang tidak dapat ditawar

1. **Hanya klien.** Tidak ada kode backend, basis data, secret server, kredensial mesin, atau kunci provider — baik dalam kode, variabel `PUBLIC_*`, `globalProps`, fixture, maupun log ([`docs/security.md`](docs/security.md)).
2. **Pemanggilan backend melalui `packages/client`.** Tidak ada `fetch` di dalam layar. Setiap pemanggilan baru wajib memiliki tes yang mengunci path, header, dan body, serta satu baris di `docs/backend-integration.md` yang merujuk ke file sumber backend.
3. **Kode background thread tidak menggunakan API `URL`, `URLSearchParams`, `crypto`, `Intl`, `Buffer`, DOM, atau Node** (`packages/client`, `packages/platform/src/{bridge,contract,runtime-config}.ts`, `packages/app`). `tests/repo-policy.test.ts` menegakkan aturan ini.
4. **Kapabilitas host melalui kontrak** (`packages/platform/src/contract.ts`, ADR-0003). Menambahkan method menaikkan `HOST_BRIDGE_VERSION` dan memperbarui setiap host serta `hosts/contract-test-vectors.json` dalam perubahan yang sama.
5. **Otorisasi adalah wewenang server.** UI boleh menyembunyikan, tetapi tidak pernah memutuskan.
6. **Jangan pernah merender HTML dari server.** Konversikan dengan `snippetToText()` atau sejenisnya.
7. **String harus ada dalam kedua locale** (`packages/app/src/i18n.ts`); bahasa Indonesia adalah default.
8. **Helper generik ditulis `function name<T>()`,** bukan arrow `<T>() =>` — transform tes ReactLynx mem-parsing `.ts` sebagai TSX.
9. **Kejujuran lebih utama daripada kemasan.** Pengaturan harus menyatakan penyimpanan sesi yang sebenarnya; dokumen harus menjelaskan apa yang telah terverifikasi, bukan yang masih direncanakan ([`docs/status.md`](docs/status.md)).
10. **Celah backend diajukan ke hulu,** bukan diakali di sini ([`docs/backend-integration.md` §Gaps](docs/backend-integration.md#gaps)).

## Tata letak dan kepemilikan

| Path | Memiliki | Tidak boleh |
| --- | --- | --- |
| `packages/client` | kontrak HTTP kedua backend | bergantung pada Lynx atau DOM |
| `packages/platform` | kontrak host, adapter bridge, konfigurasi runtime, handler host browser | bergantung pada app atau client |
| `packages/app` | layar, komponen, i18n, token, `startApp()` | memanggil `NativeModules` atau `fetch` secara langsung |
| `apps/mobile` | bundle Lynx + Web, tes UI | berisi layar |
| `apps/web` | halaman `<lynx-view>`, proxy pengembangan, contoh deploy | berisi layar |
| `apps/desktop` | proses utama Lynxtron + bundle desktop | membuka Node ke UI di luar kontrak |
| `hosts/` | host native referensi | dideskripsikan sebagai sudah dikompilasi atau terverifikasi, kecuali PoC telah melakukannya |

## Definisi selesai

- [ ] Perubahan bersifat atomik dan dapat diverifikasi secara independen; cakupannya tetap berada di dalam workspace yang relevan.
- [ ] `bun run check` hijau.
- [ ] Tes ditambahkan atau diperbarui untuk perilaku tersebut.
- [ ] Dokumentasi diperbarui dalam perubahan yang sama (sumber bahasa Inggris + mirror `.id.md` untuk README/AGENTS/halaman docs).
- [ ] Changeset ditambahkan ketika perilaku publik, struktur, dependensi, atau deployment berubah.
- [ ] Keputusan yang mengandung trade-off dicatat sebagai ADR (kelebihan dan kekurangan, keamanan, performa, maintainability, skalabilitas, aksesibilitas, SEO, UI/UX, kompatibilitas, kompleksitas operasional, dan dampak jangka panjang).

## Repositori terkait

- `ahliweb/awcms` — backend dan admin; ADR-0146 (aplikasi persona), guard `tests/product-surface-policy.test.ts` (tidak ada Lynx di sana).
- `ahliweb/awcms-one` — backend commerce + storefront Astro; ADR-0050, ADR-0016, guard `tests/lynx-direction.test.mjs` (tidak ada Lynx di sana).

## Orchestrator & agent (model AI)

> Standar lintas-portofolio dari [`ahliweb/personal-coding`](https://github.com/ahliweb/personal-coding/blob/main/docs/tingkatan-model-ai-claude-openai.md) (docs/tingkatan-model-ai-claude-openai.md, snapshot 2026-10-28). Harga, effort, dan lini model dipelihara di sana — jangan disalin ke repo ini.

Pekerjaan yang perlu dipecah ke beberapa agent memakai pola **orchestrator → agent**. Orchestrator memecah pekerjaan, membagi tugas, mengatur ketergantungan, lalu memeriksa dan menyatukan hasil; agent mengerjakan satu bagian yang sudah dibatasi.

| Peran | Claude Code | Codex / OpenAI |
| --- | --- | --- |
| Orchestrator | Opus 5.5, effort `high` | GPT-6.1 Sol, `high` |
| Agent kompleks — lintas komponen, keamanan, integrasi, risiko regresi | Sonnet 5.5, `medium` (subagent `pelaksana-kompleks`) | GPT-6.1 Sol atau Terra, `medium` |
| Agent sederhana — mekanis, terdefinisi jelas, risiko rendah | Haiku 5.5, `low` (subagent `pelaksana-sederhana`) | GPT-6 Luna atau Terra, `low` |

Pekerjaan kritis (arsitektur, keamanan, migrasi besar): orchestrator Fable 5.1 `high`–`xhigh`, agent kompleks Opus 5.5 `high`.

Aturan:

1. **Jangan memecah tugas kecil.** Coba satu model kuat (Opus 5.5 / GPT-6.1 Sol) dengan effort rendah lebih dulu.
2. **Naikkan, jangan menebak.** Agent sederhana yang menemukan ambiguitas, risiko, atau sentuhan arsitektur berhenti dan mengembalikan tugas ke orchestrator, yang memindahkannya ke agent kompleks.
3. **Agent paralel terisolasi.** Tidak boleh menyentuh file atau modul yang sama; tugas yang saling bergantung dijalankan berurutan.
4. **Verifikasi tetap di orchestrator.** Diff, uji, dan angka dicek sendiri sebelum dipakai; laporan agent bukan bukti.
5. **Agent tetap di scope-nya.** Tidak mengubah arsitektur, tidak mendelegasikan lagi, tidak menyentuh area di luar tugas.
6. **Aturan repo ini tetap berlaku** untuk setiap agent — alur kerja, gerbang, guardrail keamanan, konvensi commit.

Definisi subagent ada di [`.claude/agents/`](.claude/agents/).
