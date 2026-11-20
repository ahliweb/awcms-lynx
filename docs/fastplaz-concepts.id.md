🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](fastplaz-concepts.md)

# Diagnostik host native AWCMS-Lynx — konsep FastPlaz, arsitektur khusus repositori

## Kendali dokumen
- **Versi:** v1.1.0
- **Diperbarui:** 2026-11-20
- **Status:** Usulan arsitektur / riset saja; bukan fitur produksi. Setiap adopsi di bawah hanyalah usulan sampai gerbang 9 (cross-spec Definition of Ready) di repositori ini; tidak ada yang berupa keputusan.
- **Document Changeset:** Diperiksa ulang terhadap `main` setelah validasi kontrak 20 November 2026: sumber status, tautan anti-duplikasi, dan redaksi correlation ID dikoreksi; cermin bahasa Indonesia ditambahkan.
- **Issue pemilik:** [#9](https://github.com/ahliweb/awcms-lynx/issues/9).

## Ringkasan dan baseline lokal yang terkonfirmasi
Templat LynxJS/ReactLynx memiliki klien API backend bertipe, jembatan host, dan tes. Menurut [`status.md`](status.md), bundel Lynx, host Web (Chromium di bawah CSP produksi), dan jalannya desktop headless memiliki bukti spesifik; host Android, iOS, dan HarmonyOS adalah sumber referensi yang belum dikompilasi atau dijalankan di perangkat. [`contract-validation-2026-11.md`](contract-validation-2026-11.md) menambahkan bahwa tidak ada tes di sini yang pernah menyentuh backend live.

## Maksud dan adaptasi kandidat
Mendefinisikan diagnostik build/tes lokal yang dapat dibaca mesin per target tanpa mengganti framework. Pertahankan workspace Bun beserta toolchain Lynx berbasis Node ([ADR-0002](adr/0002-bun-workspace-with-node-runtime-for-the-lynx-toolchain.id.md)).

## Otoritas dan larangan
Tidak ada agen coding di aplikasi persona yang dikirim, tidak ada status perangkat terverifikasi palsu, tidak ada kapabilitas host baru sebelum ADR kontrak host (lihat [ADR-0003](adr/0003-one-host-bridge-contract-for-every-lynx-host.id.md)), tidak ada penulisan ulang ke Rust/Pascal.

## Issue terkait yang sudah ada dan anti-duplikasi
Halaman ini tidak mengimplementasikan apa pun yang dilacak di tempat lain; pekerjaan berikut sudah punya pemilik:

- Bukti kontrak dan gap: [#19](https://github.com/ahliweb/awcms-lynx/issues/19) (tertutup), tercatat di [`contract-validation-2026-11.md`](contract-validation-2026-11.id.md).
- CSP host Web: [#16](https://github.com/ahliweb/awcms-lynx/issues/16).
- Penandatanganan dan provenance desktop: [#17](https://github.com/ahliweb/awcms-lynx/issues/17); penyimpanan sesi desktop: [#13](https://github.com/ahliweb/awcms-lynx/issues/13) dan [#14](https://github.com/ahliweb/awcms-lynx/issues/14).
- Pengerasan CI dan SBOM: [#15](https://github.com/ahliweb/awcms-lynx/issues/15).

## Enam skenario validasi konkret
1. Bundel Web dan CSP dilaporkan terpisah dari host native.
2. Keberhasilan desktop headless di Linux tidak boleh mengklaim rilis Windows/macOS yang ditandatangani.
3. Host Android memerlukan Kotlin/JUnit dan bukti perangkat nyata.
4. Host iOS memerlukan Swift/XCTest dan bukti perangkat.
5. Host HarmonyOS memerlukan tes ArkTS/bukti perangkat.
6. Klien mengirim `X-Correlation-ID` pada setiap panggilan dan tidak pernah mencatat bearer sesi ke log ([`security.md`](security.id.md)).

## Pemeriksaan dan bukti tes yang diusulkan
Catat target, versi engine, platform, perintah, SHA bukti, dan bidang terverifikasi/belum terverifikasi. Gunakan `bun run check`, vektor kontrak (`tests/contract-vectors.test.ts`), dan verifikasi perangkat sebelum klaim apa pun. [`status.md`](status.md) tetap menjadi sumber verifikasi.

## Rollout / serah terima
Dokumentasikan pemetaan adapter tes lokal dan tunggu PoC host konsumen; tidak ada daemon agen global.

## Rujukan sumber dan batasan
Dokumen ini hanya mengambil **konsep** dari [FastPlaz](https://github.com/fastplaz/fastplaz): [MCP/AI Agent Plane](https://github.com/fastplaz/fastplaz/blob/master/docs/MCP.md), [alur kerja IDE](https://github.com/fastplaz/fastplaz/blob/master/docs/AI_AGENT_by_FASTPLAZ.md), dan [konsep operator standalone](https://github.com/fastplaz/fastplaz/blob/master/docs/STANDALONE-deployment.md). Tanpa Pascal, Lazarus, CGI, mesin MVC/tema, atau penyalinan kode sumber. [Teks lisensi FastPlaz](https://github.com/fastplaz/fastplaz/blob/master/LICENSE.txt) tidak menunjukkan izin kode sumber yang eksplisit; hanya implementasi mandiri.

## Invarian rekayasa lintas-portofolio
Menerapkan **standar lintas-portofolio internal**, berdampingan dengan AGENTS, ADR, CONTRIBUTING, dan realitas kode repositori ini. **Gerbang 9 (cross-spec Definition of Ready)** yang disetujui manusia mendahului kode fitur produksi; **gerbang 15 (kesiapan rilis)** yang disetujui manusia mendahului produksi. Satu issue/branch/PR per cakupan atomik. Jangan menyajikan spesifikasi, pemeriksaan dokumentasi yang hijau, atau riset sebagai fungsi produksi yang bekerja.

Konektor MCP/alat lokal, bila kelak diperlukan: loopback atau IPC terautentikasi, pembatasan host/Origin untuk HTTP, kredensial berotasi dengan cakupan terbatas, perlindungan path kanonis dan symlink, tingkat persetujuan baca/tulis/destruktif, tanpa shell sembarang, tanpa SQL/DB mentah/akses rahasia secara default, sumber daya/waktu/pembatalan terbatas, kebijakan ditegakkan pada runtime alat/OS yang sebenarnya, tertutup-saat-gagal untuk yang tak dikenal, dan log tersamar. Perubahan otorisasi, konfigurasi produksi, atau data sensitif memerlukan persetujuan manusia.

## Rujukan regulasi dan kendali yang relevan
Evaluasi penerapannya, bukan kepatuhan lewat pernyataan: UU 27/2022 (PDP), PP 71/2019 (PSTE), Perpres 95/2018 bila SPBE berlaku; ISO/IEC 27001, 27002, 27005, 27017, 27018, 27034, 27701, ISO 22301, ISO/IEC 20000-1, ISO/IEC 42001, ISO/IEC 15408; OWASP LLM/Agentic Security, NIST AI RMF. Peroleh bukti kendali independen dan edisi yang berlaku sebelum klaim sertifikasi apa pun.

## Rubrik bukti penerimaan
Untuk setiap tindak lanjut: tautkan spesifikasi/ADR dan issue pemilik; catat commit sumber, versi toolchain/runtime, perintah yang dijalankan, galat/hasil aktual, tes akses ditolak, dan SHA bukti. Tandai pemeriksaan yang tidak dijalankan sebagai **NOT EXECUTED**. Persetujuan dan status publikasi/deployment adalah hal yang berbeda. Tanpa data pribadi sensitif atau rahasia produksi di prompt, log, atau artefak GitHub.

## Changelog
- **v1.1.0 — 2026-11-20:** Diperiksa ulang terhadap `main`: redaksi status diselaraskan dengan `status.md`, issue terkait ditautkan alih-alih rujukan diri, redaksi correlation ID dikoreksi, tautan ADR ditambahkan, status usulan dinyatakan, cermin bahasa Indonesia ditambahkan.
- **v1.0.0 — 2026-11-10:** Mendokumentasikan batas adopsi berbasis bukti dan spesifik repositori, enam kasus praktis, dan rubrik penerimaan.
