🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](research-ai-assisted-design-evidence-2026-11-28.md)

# Bukti desain dan spesifikasi berbantuan AI — templat persona khusus klien

## Kendali dokumen
- **Versi:** v0.2.0
- **Diperbarui:** 2026-11-28
- **Status:** Usulan riset saja. Setiap butir desain, kontrol, ID sementara, dan pemetaan papan di bawah ini berstatus **usulan**; tidak ada yang berupa aturan berlaku, keputusan gerbang, atau izin implementasi.
- **Document Changeset:** Diambil alih dari draf yang ditulis di sesi lain; klaim tentang repositori ini diperiksa ulang terhadap `main`, rujukan diperiksa ulang terhadap sumbernya, nama vendor pihak ketiga dihapus, cermin bahasa Indonesia ditambahkan.
- **Issue pemilik:** [#27](https://github.com/ahliweb/awcms-lynx/issues/27) (tetap terbuka; halaman ini hanya menjadi masukan).
- **Snapshot bukti:** `main` pada `371fe3c`; blob `AGENTS.md` `d97c6c85b12e` (prefiks blob, bukan SHA commit).

## Bukti riset
Tinjauan cepat atas sumber publik primer, bukan tinjauan sistematis atau uji produk. Riset dipicu oleh uraian publik produk komersial perencanaan dan desain berbantuan AI di bidang ini. Halaman ini hanya memakai konsep fungsional umum dan standar terbuka: tanpa kode, aset, API, teks, aturan, atau rekayasa balik produk pihak ketiga mana pun, dan tanpa penilaian atas klaim vendor mana pun. Klaim fitur vendor tidak membuktikan efektivitas.

- Cui dkk. (eksperimen lapangan atas tugas selesai, Management Science, [DOI](https://doi.org/10.1287/mnsc.2025.00535)): **tidak terverifikasi saat pengambilalihan** (halaman penerbit menolak akses). Tahun, jumlah peserta, dan angka efek tidak dituliskan di sini.
- [METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/): 16 developer berpengalaman, 246 issue, waktu penyelesaian 19% lebih lama dengan alat AI; halaman itu sendiri menandai hasilnya tidak mutakhir. [Pembaruan 2026-02-24](https://metr.org/blog/2026-02-24-uplift-update/) melaporkan perubahan desain studi dan efek seleksi. Pembacaan halaman ini, bahwa hasilnya berbeda-beda dan tidak ada efek gabungan atau ROI lokal yang dapat diprediksi, adalah simpulan, bukan kutipan.
- [Perry dkk.](https://arxiv.org/abs/2211.03622): dalam studi pengguna terbatas, peserta dengan asisten AI menulis kode yang kurang aman dan lebih cenderung percaya kodenya aman.
- [Spec Kit](https://github.com/github/spec-kit): mendokumentasikan langkah klarifikasi dan analisis lintas artefak baca-saja, dipakai di sini sebagai konsep untuk tinjauan lintas spesifikasi.
- [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/): Final Community Group Report 28 Okt 2025, bukan W3C Recommendation; dipakai sebagai rujukan format token yang netral vendor.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf/publications): versi 1.1 final (2022); versi 1.2 berstatus draf (rilis 2025-12-17).
- [ISO 12207](https://www.iso.org/standard/90219.html) (proses siklus hidup), [ISO 9241-210](https://www.iso.org/standard/77520.html) (desain berpusat pada manusia), dan [WCAG 2.2](https://www.w3.org/TR/WCAG22/): **tidak terverifikasi saat pengambilalihan** (halaman katalog ISO 12207 menolak akses; ISO 9241-210 dan WCAG 2.2 di luar himpunan yang diperiksa). Tahun edisi dari draf tidak diulang sebagai fakta.
- [UU pelindungan data pribadi](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022) (halaman dibuka; teks pasal tidak dibaca) dan [UU hak cipta](https://peraturan.bpk.go.id/Details/38690/uu-no-28-tahun-2014) (**tidak terverifikasi saat pengambilalihan**): dirujuk hanya sebagai undang-undang yang berlaku; tidak ada pasal yang dikutip.

## Cakupan dan pilot
Hanya klien Lynx, tanpa basis data atau rahasia server; kontrak API dan host tetap kanonis. Baca dokumentasi resmi runtime Lynx dan batasan host yang ada ([`lynx-runtime.md`](lynx-runtime.id.md), [`status.md`](status.id.md)) sebelum proof of concept.

Pilot yang diusulkan: layar persetujuan sintetis dengan status pending, expired, denied, dan confirmed, urutan fokus, aksesibilitas, dan pemetaan token semantik di seluruh host yang didukung. Bedakan bukti perangkat nyata dari emulasi web; jangan mengklaim paritas. Tanpa backend dan tanpa runtime baru.

## Kontrak bukti
Usulan, belum berlaku. Pakai ulang kebutuhan, ADR, dan artefak kanonis yang ada. Telusuri kebutuhan/kriteria penerimaan → UI (bila berlaku) → data/izin/operasi → tes/bukti; catat butir yang teramati, disetujui, disimpulkan, tidak diketahui, dan diusulkan secara terpisah. Kunci SHA sumber sebenarnya sebelum pilot. Catat tinjauan kontekstual, kasus sintetis, baseline, serta pemeriksaan WCAG 2.2 manual dan otomatis yang relevan; tanpa klaim kepatuhan dari otomasi saja. Tandai artefak UI N/A beserta alasannya bila repositori ini tidak memiliki UI. Ukur waktu termasuk tinjauan dan pengerjaan ulang, biaya, cacat dan temuan keamanan, serta keberhasilan tugas; tanpa hasil karangan. Konflik kembali ke spesifikasi pemilik dan gerbang yang berlaku.

## Keselamatan dan kepemilikan
Hanya konsep, tanpa menyalin kode atau aset berpemilik, tanpa dependensi baru. Minimalkan konteks, pakai fixture sintetis, privilese minimum, redaksi, serta persetujuan penyedia dan egress sebelum data keluar dari mesin. Tanpa klaim sertifikasi. Halaman ini tidak memberi persetujuan implementasi atau arsitektur: issue #27 memiliki validasi lebih dalam, CI khusus repositori, dan tinjauan.

## Koordinasi siklus hidup lewat GitHub Projects
Arahan tercatat di issue #27 (2026-11-28): koordinasikan langkah alur pengembangan yang berlaku lewat GitHub Projects (v2), terintegrasi dengan manajemen proyek yang ada, bukan papan kedua dan bukan pengganti otoritas repositori. Semua di bawah ini adalah **usulan**.

- Langkah 1–8: lacak deliverable riset dan spesifikasi, ketergantungan, peninjau, kriteria penerimaan, dan URL bukti; tidak ada issue implementasi sebelum gerbang 9 yang berlaku. Langkah 9: pelacak gerbang merujuk keputusan yang tercatat, tidak pernah yang disimpulkan dari tahap papan.
- Langkah 10–12: satu issue kanonis per unit S/M, relasi parent/sub-issue dan blocked-by native bila didukung, milestone, prioritas, dan assignee dipertahankan; PR merujuk issue dan bukti CI. Langkah 13–15: staging dan UAT hanya bila berlaku, bukti kesiapan rilis dan keputusan. Langkah 16–18: deployment, validasi, pemantauan, dan tindak lanjut dengan bukti rilis atau insiden.
- Pakai ulang proyek yang disetujui beserta field yang ada; pemetaan status yang diusulkan: Rencana = backlog, Siap = definition of ready yang berlaku, Berjalan = diklaim, Menunggu = ketergantungan, tinjauan, atau persetujuan, Selesai = hasil terverifikasi, Batal = dibatalkan beserta alasan. Langkah siklus hidup terpisah dari tahap. Penolakan gerbang tetap tercatat walau item pelacak ditutup. PR ditutup tanpa merge, issue duplikat atau not-planned, atau bukti yang hilang tidak pernah otomatis ditandai Selesai. Pertahankan pemilik, assignee, dan target; jangan mengarang tenggat.
- Temukan pemilik, nomor, akses, dan ID field proyek yang hidup; tambahkan issue yang ada lewat URL atau node ID secara idempoten, dengan diff dry-run, baca ulang, dan rekonsiliasi; pertahankan satu issue kanonis dan bedakan item PR dari hitungan pekerjaan. Tanpa kartu draf bersama atau konteks rahasia. Tinjau izin, hindari seeding luas atau konflik otomasi status, jangan pernah memindahkan item lintas batas visibilitas secara otomatis. Papan hanya untuk koordinasi, bukan otoritas merge atau deploy. Keanggotaan proyek tidak diperiksa dalam riset ini.

Rujukan: [perencanaan dan pelacakan dengan Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects), [memakai API untuk mengelola Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects), [dependensi issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies), [status issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issue-statuses). Halaman dokumentasi GitHub ini tidak dibuka ulang saat pengambilalihan.

## Verifikasi rujukan saat pengambilalihan (2026-11-28)
Rujukan draf dibuka ulang secara baca-saja pada 2026-11-28 (hanya ringkasan halaman; tanpa unduhan atau login).

- **Didukung (5 sumber, 6 halaman):** METR 2025 beserta pembaruan 2026, Perry dkk., Spec Kit, DTCG 2025.10, dan NIST SSDF. METR dikoreksi: ia menghitung 246 *issue*, bukan tugas, dan menandai hasilnya sendiri tidak mutakhir. Halaman UU pelindungan data pribadi dibuka, tetapi teks pasalnya tidak dibaca.
- **Tidak terverifikasi saat pengambilalihan (5):** Cui dkk. (halaman penerbit menolak akses; setiap angka yang dikaitkan dengannya dihapus), ISO 12207, ISO 9241-210, WCAG 2.2, dan halaman UU hak cipta. Verifikasi manual sebelum dijadikan sandaran.
- **Dihapus:** dua halaman produk komersial beserta uraiannya, satu rujukan format alat desain komersial, dan penilaian atas klaim vendor (ini repositori publik).
- **Klaim uji:** tidak ada yang dibuat di sini. Hasil uji apa pun yang dikutip di sesi asal adalah milik spike referensi di luar repositori ini, tidak dijalankan di sini, dan bukan bukti implementasi.
- **Tidak dikerjakan:** tidak ada rujukan baru ditambahkan; halaman dokumentasi GitHub di atas tidak dibuka ulang; tidak ada CI dijalankan secara lokal (bukti adalah check run GitHub setelah push).

## Changelog
- **v0.2.0 — 2026-11-28:** Pengambilalihan: klaim repositori dan rujukan diperiksa ulang, angka dari sumber tak terverifikasi dihapus, nama vendor dinetralkan, status dinyatakan sebagai usulan, cermin bahasa Indonesia, baris indeks, dan changeset ditambahkan.
- **v0.1.0 — 2026-11-28:** Draf riset awal (ditulis di sesi lain).
