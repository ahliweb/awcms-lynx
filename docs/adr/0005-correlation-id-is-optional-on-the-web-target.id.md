🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](0005-correlation-id-is-optional-on-the-web-target.md)

# ADR-0005 — `X-Correlation-ID` opsional di target Web; aturan hanya-proxy dipertahankan

- **Status:** Diterima
- **Tanggal:** 20 November 2026
- **Pengambil keputusan:** ahliweb (keputusan pemilik D-3, dicatat dari validasi kontrak issue #19)
- **Terkait:** ADR-0003, ADR-0004; `docs/contract-validation-2026-11.md` F-03, F-04, R-3; `docs/backend-integration.md` §CORS; awcms-one `commerce-cors.ts`

## Konteks

Klien mengirim `X-Correlation-ID` pada setiap permintaan agar laporan pengguna dapat dicocokkan dengan baris log server. Lynx native dan Lynxtron tidak memiliki CORS, sehingga header ini tidak berbiaya di sana. Peramban berbeda: permintaan dengan header di luar safelist memicu preflight. Route commerce awcms-one menjawab preflight hanya dengan `content-type` dan `authorization` (ditambah `idempotency-key` pada sebagian route), route staf awcms tidak punya handler CORS, dan pencarian situs sengaja tidak memasangnya. Mendaftarkan origin Web sebagai domain tenant karenanya tidak membuat build Web lintas-origin langsung berfungsi (F-04). CORS commerce awcms-one juga hanya mengekspos `retry-after` ke skrip lintas-origin, sehingga gaung header dari server tidak terbaca di sana.

## Keputusan

**D1.** Aturan reverse proxy satu-origin untuk target Web tetap berlaku (`apps/web/deploy/`). Klien tidak bergantung pada panggilan lintas-origin langsung.

**D2.** `X-Correlation-ID` opsional di target Web: klien tidak mengirimnya di sana. `ClientConfig.sendCorrelationId` (boolean atau fungsi, bawaan `true`) mengaturnya; aplikasi menurunkannya dari jenis host yang dilaporkan `app.info` (`web` menghilangkan header). Sebelum `app.info` menjawab, bawaan native berlaku; tidak ada panggilan API sebelum boot selesai.

**D3.** Target native (iOS, Android, HarmonyOS, desktop) tetap mengirim header.

**D4.** Bila header tidak dikirim, `AwcmsApiError.correlationId` adalah gaung server bila header respons terbaca (proxy satu-origin), selain itu `null`. Id buatan klien yang belum pernah dilihat server tidak pernah dilekatkan pada error.

**D5.** Bearer tidak pernah ditulis ke error atau log di kedua target; tes mengunci hal ini.

## Opsi yang dibandingkan

| Opsi | Kelebihan | Kekurangan |
| --- | --- | --- |
| A. Hilangkan header di Web, pertahankan hanya-proxy (dipilih) | Perubahan terkecil; tanpa edit backend; header ini tidak menambah preflight; penelusuran native tidak berubah | Permintaan Web tidak dapat ditelusuri dengan id buatan klien; server mencatat id-nya sendiri, terbaca hanya lewat proxy |
| B. Minta awcms-one mengizinkan `x-correlation-id` di preflight | Penelusuran seragam di semua target | Perubahan backend di repositori lain; memperlebar allowlist CORS; route staf dan pencarian situs tetap butuh handler; lebih lambat |
| C. Tetap kirim di mana-mana, dokumentasikan batasnya | Tanpa perubahan kode | Panggilan Web lintas-origin langsung tetap rusak; batas terdokumentasi adalah cacat yang sengaja dikirim |

Keamanan: A tidak menambah header yang diizinkan dan tidak melemahkan kontrol apa pun; B memperlebar allowlist lintas-origin. Performa: A menghilangkan satu round trip preflight yang akan mendahului panggilan lintas-origin. Maintainability: satu opsi boolean, diuji per target. Skalabilitas dan SEO: tidak terpengaruh. Aksesibilitas dan UI/UX: tidak ada perubahan terlihat; layar error menampilkan id hanya bila diketahui. Kompatibilitas: kompatibel mundur bagi pemanggil yang ada (bawaan `true`). Kompleksitas operasional: tidak bertambah; proxy memang sudah wajib. Jangka panjang: bila backend kelak mengizinkan header, target Web dapat ikut lewat konfigurasi tanpa perubahan kontrak.

## Konsekuensi

- Laporan dukungan dari build Web tidak dapat mengutip id buatan klien; id sisi server tersedia hanya bila header respons terbaca.
- `docs/security.md`, `docs/backend-integration.md`, dan README klien menjelaskan perilaku per target.
- Produk yang menyajikan build Web lintas-origin tetap membutuhkan backend yang menangani preflight; ADR ini tidak menyediakannya.
