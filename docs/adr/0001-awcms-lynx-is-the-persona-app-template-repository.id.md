🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](0001-awcms-lynx-is-the-persona-app-template-repository.md)

# ADR-0001 — awcms-lynx adalah repositori template aplikasi persona terpisah untuk keluarga AWCMS

- **Status:** Diterima
- **Tanggal:** 25 Oktober 2026
- **Pengambil keputusan:** ahliweb
- **Terkait:** ahliweb/awcms ADR-0146 (aplikasi persona lebih memilih Lynx di repositori konsumen; status Diusulkan); ahliweb/awcms-one ADR-0050 (LynxJS untuk aplikasi persona terpisah; Astro tetap untuk admin dan profil publik) dan ADR-0024 (kepemilikan khusus template); ahliweb/awcms-one ADR-0016 (sesi bearer pelanggan)

## Konteks

Kedua backend keluarga ini telah memutuskan *di mana* klien Lynx boleh berada, dan tempat itu bukan di dalam keduanya:

- **awcms ADR-0146** menjadikan `persona-app-native` (LynxJS + ReactLynx, kandidat yang paling diutamakan) sebagai permukaan yang hanya hidup "di repositori konsumen", menjaga setiap permukaan web admin dan publik tetap di Astro, dan menegakkan pengecualian ini secara mekanis: `tests/product-surface-policy.test.ts` gagal jika `package.json` mendeklarasikan paket `@lynx-js/*`, jika `src/` mengimpor salah satunya, atau jika `lynx.config.*` ada di mana pun dalam repositori tersebut.
- **awcms-one ADR-0050 D3** menyatakan bahwa aplikasi persona hidup di repositori terpisah, di luar workspace tersebut; `tests/lynx-direction.test.mjs` gagal jika sebuah manifest bergantung pada Lynx atau direktori di bawah `apps/` cocok dengan `lynx`.

Yang belum dimiliki kedua repositori adalah *titik awal* yang akan disalin oleh produk turunan: sebuah workspace Lynx yang sudah berbicara dengan kontrak HTTP backend secara benar (envelope, header tenant, idempotency, sesi bearer, kode error), sudah berjalan di setiap target Lynx, dan sudah mencatat celah yang harus ditutup oleh aplikasi produksi.

## Keputusan

**D1.** `ahliweb/awcms-lynx` adalah titik awal tersebut: repositori template GitHub yang berisi satu basis kode ReactLynx dan host-host yang menjalankannya — iOS, Android dan HarmonyOS native (`hosts/`), Lynx for Web (`apps/web`), serta macOS/Windows melalui Lynxtron (`apps/desktop`).

**D2.** Repositori ini hanya berupa **klien**. Repositori ini tidak memiliki backend, basis data, migrasi, secret, ataupun tenant. Repositori ini berkomunikasi dengan instans `ahliweb/awcms` atau `ahliweb/awcms-one` yang dimiliki produk turunan, melalui API terdokumentasi milik instans tersebut (awcms-one ADR-0050 D4, awcms ADR-0146 §2.1–2.2). Repositori ini tidak pernah mengimpor source backend dan tidak pernah menyimpan kunci provider atau kredensial mesin.

**D3.** Satu build menargetkan satu profil backend, yang dipilih melalui `PUBLIC_AWCMS_BACKEND`:

| Profil | Backend | Persona | Sign-in |
| --- | --- | --- | --- |
| `awcms` | ahliweb/awcms | staf / anggota / petugas lapangan | `POST /api/v1/auth/login` → bearer opak + `X-AWCMS-Tenant-ID`, dengan MFA dan pemilihan keanggotaan |
| `awcms-one` | ahliweb/awcms-one | pelanggan | kode satu kali via e-mail → sesi bearer `cs_` (ADR-0016) |

**D4.** Produk turunan dibuat dengan *Use this template* di GitHub, lalu memiliki salinannya sepenuhnya, sebagaimana diwajibkan awcms-one ADR-0024 bagi produk yang dibuat dari template. Repositori ini tidak boleh pernah menjadi dependensi runtime sebuah produk.

**D5.** Gerbang proof of concept ADR-0050 D6 / ADR-0146 §5 **tidak** dihapuskan oleh template ini. Template membuat PoC lebih murah — klien API, kontrak host, dan host sudah tersedia — tetapi setiap produk turunan tetap harus mencatat hasil PoC-nya per target sebelum masuk produksi. `docs/status.md` mencantumkan, target demi target, apa yang telah dan belum diverifikasi oleh repositori ini.

## Opsi yang dipertimbangkan

| Kriteria | Repositori template terpisah (dipilih) | Aplikasi Lynx di dalam awcms-one | Satu aplikasi per produk, tanpa template |
| --- | --- | --- | --- |
| Keamanan | Repositori khusus klien; tidak ada secret backend yang dapat bocor ke dalamnya | Diblokir oleh ADR-0050 D3 dan tes guard-nya | Setiap tim menurunkan ulang auth/penyimpanan, kemungkinan secara tidak konsisten |
| Performa | Rendering native per Lynx; diukur melalui PoC produk masing-masing | n/a | Sama |
| Maintainability | Satu klien API dan kontrak host yang ditinjau bersama | Mencampur backend yang hanya Bun dengan toolchain yang membutuhkan Node | Diduplikasi per produk |
| Skalabilitas | Aplikasi dapat berskala secara independen dari backend | Menggabungkan siklus rilis | Sama seperti pilihan, tetapi tanpa penggunaan ulang |
| Aksesibilitas | Komponen bersama membawa atribut a11y sekali saja | n/a | Per tim |
| SEO | Tidak berlaku untuk aplikasi persona; SEO publik tetap di Astro | n/a | n/a |
| UI/UX | Design token dan layar yang dipakai bersama | n/a | Berbeda-beda |
| Kompatibilitas | Lima target Lynx dari satu sumber | n/a | Biasanya hanya satu atau dua |
| Kompleksitas operasional | Satu repositori tambahan, tanpa runtime | Melanggar dua tes guard | Tertinggi |
| Jangka panjang | Pembaruan diadopsi secara sengaja oleh setiap produk | Biaya pembalikan tinggi | Drift |

## Konsekuensi

- Backend tetap bebas dari Lynx; tes guard mereka tetap lulus.
- Repositori ini memiliki keputusan toolchain sendiri (ADR-0002), kontrak host (ADR-0003), dan kebijakan penyimpanan sesi (ADR-0004).
- Celah pada backend yang menghalangi aplikasi persona produksi (autentikasi staf yang mendukung native, refresh, API katalog anonim, push pelanggan) didokumentasikan di `docs/backend-integration.md` dan harus diajukan sebagai issue API di repositori backend (ADR-0146 §6.5), bukan ditambal di sini.
