🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](security.md)

# Keamanan dan privasi

Model ancaman, kontrol, dan standar yang menjadi acuannya. Backend adalah batas keamanan — otorisasi, isolasi tenant (row-level security), pembatasan laju, dan audit semuanya terjadi di sana. Klien ini tidak boleh melemahkannya, dan wajib melindungi apa yang dipegangnya: token sesi dan data pribadi yang tampil di layar.

## Aset dan ancaman

| Aset | Ancaman | Kontrol di repositori ini |
| --- | --- | --- |
| Bearer sesi (`awcms` staf / `cs_` pelanggan) | Pencurian dari penyimpanan perangkat, log, laporan crash, cadangan | Disimpan hanya melalui `secureStorage` (Keychain, Keystore AES-GCM, HUKS, OS keyring) — ADR-0004; tidak pernah dicatat dalam log; tidak pernah berada di `globalProps` atau `PUBLIC_*` |
| Bearer sesi | Penggunaan setelah keluar | `logout()` mencabut di sisi server dan selalu menghapus secara lokal; `401` juga menghapusnya |
| Rahasia backend (kredensial mesin, kunci provider) | Ikut terkirim di dalam bundle | Tidak didukung secara desain: hanya `PUBLIC_*`; katalog menggunakan indeks storefront publik alih-alih token mesin (`docs/backend-integration.md`) |
| Data tenant / pengguna lain (BOLA/IDOR) | Klien mengirim ID milik orang lain | Backend menegakkan ABAC + RLS pada setiap permintaan; klien tidak pernah memutuskan akses |
| Kapabilitas host | Bundle yang disusupi membuka URL `javascript:`/`intent:` atau membaca kunci lain | Host memvalidasi ulang: namespace kunci `awcms-lynx:*`, nilai ≤ 16 KiB, `link.open` hanya http/https (ADR-0003 D3) |
| Transport | Penyadapan | `normaliseBaseUrl` menolak non-https kecuali loopback/LAN privat; host native mempertahankan default TLS platform (ATS, Network Security Config) |
| Merender markup yang disisipkan | XSS melalui cuplikan pencarian | Teks `<text>` Lynx dirender sebagai teks, bukan HTML; `snippetToText()` menghapus tag dan mendekode entitas |
| Host web | XSS yang mencuri sesi tersimpan di peramban | CSP dan header keamanan di `apps/web/deploy/`; `sessionStorage` secara default untuk staf; API dengan origin yang sama |
| Penyalahgunaan | Credential stuffing, brute force OTP | Batas di sisi server (login 20/menit, OTP 5/jam); aplikasi menampilkan `Retry-After` |

## Aturan untuk kontributor

1. Jangan pernah menambahkan rahasia ke bundle, variabel `PUBLIC_`, `globalProps`, fixture pengujian yang tampak nyata, atau baris log.
2. Jangan pernah memutuskan otorisasi di UI. Menyembunyikan tombol adalah UX; `403` dari server adalah kontrolnya.
3. Jangan pernah merender HTML yang disediakan server. Ubah menjadi teks.
4. Kapabilitas host baru adalah perubahan kontrak (ADR-0003 D5) dengan validasi di kedua sisi dan vektor uji.
5. Panggilan backend baru harus melalui `packages/client`, jangan pernah `fetch` mentah di layar.
6. Data pribadi (nama, email, telepon, pesanan) ditampilkan, tidak disimpan: satu-satunya data pribadi yang disimpan adalah `account` di dalam rekaman sesi pelanggan.

## Pemetaan standar

| Standar / regulasi | Yang diminta | Tempat repositori ini menjawab |
| --- | --- | --- |
| OWASP MASVS v2 — STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE | Data sensitif di penyimpanan aman platform; TLS; interaksi platform yang tervalidasi | ADR-0004; penyimpanan aman `hosts/`; validasi sisi host; `normaliseBaseUrl` |
| OWASP ASVS 4.0 (V3 sesi, V8 perlindungan data, V14 konfigurasi) | Pencabutan, tidak ada rahasia di klien, header yang diperkeras | semantik logout, aturan `PUBLIC_*`, header `apps/web/deploy/` |
| ISO/IEC 27001:2022 + 27002:2022 (A.5.15 kontrol akses, A.8.24 kriptografi, A.8.25–8.28 pengembangan yang aman, A.8.9 konfigurasi) | Kontrol yang terdokumentasi dan SDLC yang aman | halaman ini, ADR, gerbang CI (`bun run check`), code review |
| ISO/IEC 27005:2022 | Penanganan berbasis risiko | tabel "Aset dan ancaman"; kekurangan dicatat di `docs/backend-integration.md` |
| ISO/IEC 27034 (keamanan aplikasi) | Kontrol keamanan aplikasi yang terkait dengan siklus hidup | pengujian kontrak, aturan lint yang melarang `any`/non-null assertion, tabel ancaman per fitur |
| ISO/IEC 27701:2019 / 27018:2019 | Minimisasi PII dan transparansi pemrosesan | tidak ada cache PII di luar rekaman sesi; tidak ada SDK analitik di templat |
| ISO/IEC 27017:2015 | Tanggung jawab pelanggan/penyedia cloud | backend dan hosting-nya menjadi milik produk turunan (ADR-0001 D2) |
| ISO/IEC 15408 (Common Criteria) | Fungsi keamanan yang dievaluasi | tidak diklaim; produk yang memerlukan sertifikasi mengevaluasi build-nya sendiri |
| ISO/IEC 22301:2019 | Kesinambungan | klien tidak memiliki state utama; rencana kesinambungan backend yang berlaku |
| ISO/IEC 20000-1:2018 | Manajemen layanan | catatan rilis dari changeset; rilis berversi dan diberi tag |
| UU No. 27/2022 (Pelindungan Data Pribadi) dan PP No. 71/2019 (PSTE) | Pemrosesan yang sah, keamanan data pribadi, kewajiban pemberitahuan pelanggaran data, hak subjek data | minimisasi data di atas; data akun berasal dan diperbaiki di backend; produk yang memproses data sensitif menjalankan DPIA (ADR-0146 §2.8) |

## Melaporkan kerentanan

Lihat [`SECURITY.md`](../SECURITY.md).
