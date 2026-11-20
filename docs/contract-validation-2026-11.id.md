🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](contract-validation-2026-11.md)

# Validasi kontrak dua backend dan gap aplikasi persona — November 2026

Catatan riset untuk issue #19, bertanggal 20 November 2026. Dokumen ini membaca ulang API yang dikonsumsi `packages/client` dari sumber backend, membandingkannya dengan [`backend-integration.md`](backend-integration.md), menilai ulang setiap gap yang terdokumentasi, dan mengusulkan rencana uji consumer-kontrak. Ia tidak mengubah kode, tidak menambah endpoint, dan tidak menyatakan target native mana pun berfungsi. Keputusan yang dibiarkan terbuka bagi pemilik telah diambil pada 20 November 2026 dan dicatat di bagian akhir (§Keputusan pemilik); teks riset di atasnya tidak diubah dan masih membacanya sebagai terbuka.

Posisi pekerjaan ini dalam alur pengembangan (ADR-0156 `ahliweb/awcms`, standar lintas-portofolio internal pemilik): masukan riset untuk pekerjaan kontrak dan Definition of Ready sebelum gerbang 9. Tidak ada issue implementasi di bawah yang boleh dibuka sebelum gerbang itu, dan tidak ada yang menyatakan gerbang lolos. ADR-0146 `ahliweb/awcms` masih berstatus **Proposed**, dan tidak ada ADR diterima yang meng-admit `awcms-lynx` secara nama; halaman ini tidak menyatakan sebaliknya.

## Cakupan dan metode

- Dalam cakupan: request, response, header, envelope error, paginasi, dan aturan tenant/origin dari operasi yang dipanggil klien, untuk kedua profil; auth, sesi, CORS, 204, rate limit, idempotensi; konsistensi OpenAPI; kapabilitas host; gap yang tercantum di `backend-integration.md`.
- Di luar cakupan: route backend baru, rahasia, pekerjaan database, perubahan API upstream, pernyataan bahwa rilis native lolos.
- Metode: repositori backend dibaca pada commit terkunci di bawah dengan `git show origin/main:<path>` dan `git grep`, tanpa checkout dan tanpa mengubahnya. File route, path OpenAPI, dan konstanta handler dibandingkan satu per satu dengan metode klien. Tes di repositori ini dijalankan dengan Bun 1.4.4.
- Tidak dilakukan, dan dinyatakan: tidak ada request ke backend yang berjalan, tidak ada preflight CORS browser yang diamati, dan tidak ada host native yang dikompilasi (lingkungan punya JDK tetapi tidak punya Gradle, adb, Xcode, maupun toolchain HarmonyOS). Setiap temuan "source" di bawah adalah pembacaan kode, bukan pertukaran yang terekam.

## Baseline terkunci

| Repositori | Ref | SHA | Tanggal | Catatan |
| --- | --- | --- | --- | --- |
| `ahliweb/awcms-lynx` | `main` | `e9c3b22569502fae8202b237f9ca479467d0d765` | 2026-11-07 | klien yang diuji |
| `ahliweb/awcms` | `main` (v10.12.0) | `765e52c7aca35e91a57ed24fc04a035176a32c95` | 2026-11-19 | profil `awcms`; snapshot yang dikutip `backend-integration.md` adalah `8ceb80ea34b75ab98f099c5853c8a96f9a3659be` (2026-10-25), leluhur 159 commit di belakang |
| `ahliweb/awcms-one` | `main` (v0.20.0) | `66b9985ad753d815ad8f85f6392487087f4a8e8f` | 2026-11-19 | profil `awcms-one`; snapshot lama adalah v0.18.0 (`b6bdbbe90817056193cdd09bb4cd01e92890aa8f`) |
| `awcms` di dalam `apps/cms` milik `awcms-one` | merge subtree | `32863de8ccd01071bcf9938739beafd73086eabf` (merge `1e923b184be1582c9916b1ce4f7a20383ee4824d`) | 2026-11-19 | empat commit di belakang `main` `awcms`; tidak ada yang menyentuh `src/pages/api` maupun `src/middleware.ts` |

Perubahan antara snapshot lama dan baru, untuk file yang bergantung pada klien: `src/middleware.ts` (pembungkus metrik HTTP, header cache halaman auth), `src/lib/security/rate-limit.ts` (peringatan bila beberapa instance berjalan tanpa Redis), `src/lib/security/request-body-limit.ts` (pembaca byte mentah ditambah; default 128 KiB tidak berubah), `src/pages/api/v1/site-search/query.ts` (pencocokan prefiks pada token terakhir). `api-response.ts`, `idempotency-key-bound.ts`, `request-locale.ts`, dan `auth/login.ts` tidak berubah. Di `awcms-one`, route pelanggan berubah pada `otp/request.ts`, `otp/verify.ts`, dan `logout.ts` (keamanan kirim ganda issue #513; pencabutan push saat logout) serta `commerce-cors.ts`.

## Legenda klasifikasi

| Kelas | Arti |
| --- | --- |
| VERIFIED | Dibaca di sumber backend pada SHA terkunci dan, bila sisi klien relevan, dikunci oleh unit test yang lolos di sini. Tidak menyatakan apa pun tentang deployment yang berjalan. |
| ASSUMED | Dipercaya benar dari dokumentasi atau komentar, tidak dibaca ulang atau dijalankan ulang pada putaran ini. |
| PLANNED | Desain atau issue ada, atau direkomendasikan di sini, tetapi belum ada yang diimplementasikan. |
| DEFERRED | Sengaja tidak dikerjakan sampai produk membutuhkannya atau gerbang lolos. |
| ALREADY FIXED | Gap yang dicatat sebelumnya dan kini sudah ditutup backend (setidaknya sebagian). |
| NOT APPLICABLE | Tidak berlaku untuk klien ini. |

## Aturan bersama yang diperiksa ulang

| Aturan | Kini | Kelas | Bukti |
| --- | --- | --- | --- |
| Envelope `{success, data, meta}` / `{success:false, error:{code,message,details?}, meta}` | tidak berubah; `meta` dapat memuat `correlationId` dan `requestId`; helper menghasilkan 200 (`ok`), 201 (`created`), dan `fail` | VERIFIED | `awcms` `src/modules/_shared/api-response.ts` |
| `X-Correlation-ID` digaungkan | tidak berubah | VERIFIED | `awcms` `src/middleware.ts` baris 49-64 |
| Tetapi tidak terbaca lintas-origin | CORS commerce hanya mengekspos `retry-after`; klien memakai id yang ia kirim | VERIFIED | `awcms-one` `apps/cms/src/modules/commerce/domain/commerce-cors.ts`; `packages/client/src/http.ts` |
| `Idempotency-Key` 1-255 ASCII terlihat, `400 IDEMPOTENCY_KEY_INVALID` | tidak berubah; kunci kini dilingkup per aktor dan hash request berkunci (ADR-0145) — klien tidak melihat perbedaan | VERIFIED | `awcms` `src/lib/security/idempotency-key-bound.ts`, ADR-0145 |
| 429 + `Retry-After` | tidak berubah; dengan `APP_INSTANCE_COUNT` di atas 1 tanpa Redis, batas efektif dikalikan jumlah instance (urusan deployment, tampak hanya sebagai batas yang lebih longgar) | VERIFIED | `awcms` `src/lib/security/rate-limit.ts` |
| Batas body 128 KiB | tidak berubah | VERIFIED | `awcms` `src/lib/security/request-body-limit.ts` |
| TTL sesi staf 120 menit, tanpa refresh | default `AUTH_SESSION_TTL_MIN` 120; tidak ada route refresh; tidak ditemukan perpanjangan sliding (pencarian negatif, perintah di §Reproduce) | VERIFIED | `awcms` `src/modules/identity-access/application/login-policy.ts`; `git grep -i refresh -- src/pages/api/v1/auth` |
| Batas login 20/menit per sumber, 5 kegagalan lalu kunci 15 menit | tidak berubah | VERIFIED | file yang sama, `DEFAULT_RATE_LIMIT_MAX_ATTEMPTS`, `DEFAULT_MAX_FAILED_ATTEMPTS`, `DEFAULT_LOCKOUT_MINUTES` |
| Sesi pelanggan 30 hari sliding | tidak berubah; disentuh paling sering tiap 5 menit | VERIFIED | `awcms-one` `customer-session-token.ts` (`CUSTOMER_SESSION_TTL_SECONDS`), `customer-account-store.ts` (`SESSION_TOUCH_THRESHOLD_SECONDS`) |
| 204 pada logout pelanggan | tidak berubah; logout kini juga mencabut perangkat push yang didaftarkan sesi itu, dalam transaksi yang sama | VERIFIED | `awcms-one` `account/logout.ts` |

## Matriks profil awcms

Setiap baris: Bearer adalah token staf buram; header tenant `X-AWCMS-Tenant-ID` bila klien mengirimnya; path sumber ada di `ahliweb/awcms` pada `765e52c7`. "Di OpenAPI" adalah keberadaan path di `openapi/awcms-public-api.openapi.yaml` pada SHA yang sama. Sisi klien setiap baris dikunci oleh `packages/client/src/__tests__/awcms.test.ts` dengan fetch yang disuntikkan.

| Operasi (metode klien) | File route | Auth dan tenant | Hasil yang ditangani klien | Di OpenAPI | Kelas |
| --- | --- | --- | --- | --- | --- |
| `health()` | `src/pages/api/v1/health.ts` | anonim | `{status, service, runtime, moduleCount, generatedAt}` | ya | VERIFIED |
| `login()` | `src/pages/api/v1/auth/login.ts` | anonim; tenant opsional | 200 `{token, expiresAt}`; `409 MEMBERSHIP_SELECTION_REQUIRED`; `401 MFA_REQUIRED`; `401 MFA_ENROLLMENT_REQUIRED`; `TURNSTILE_REQUIRED` / `TURNSTILE_INVALID`; `401 INVALID_CREDENTIALS`; `429 RATE_LIMITED` | ya | VERIFIED |
| `selectTenant()` | `src/pages/api/v1/auth/session/tenant.ts` | token principal | 200 `{token, expiresAt, tenantId}` | ya | VERIFIED |
| `verifyTotp()` | `src/pages/api/v1/auth/mfa/totp/verify.ts` | token tantangan MFA | 200 `{token, expiresAt, assuranceLevel}` | ya | VERIFIED |
| `me()` | `src/pages/api/v1/auth/me.ts` | Bearer + tenant | identitas (mengembalikan login identifier mentah, tanpa peran) | ya | VERIFIED |
| `session()` | `src/pages/api/v1/auth/session.ts` | Bearer + tenant | peran, assurance, kedaluwarsa, scope | ya | VERIFIED |
| `logout()` | `src/pages/api/v1/auth/logout.ts` | Bearer + tenant | sukses; sesi lokal dibersihkan apa pun hasilnya | ya | VERIFIED |
| `siteSearch()` | `src/pages/api/v1/site-search/query.ts` | anonim; diselesaikan dari Host, atau dari `Origin` bila lintas-origin (ADR-0107) | `{items, nextCursor, facets, query, locale}`; default 60 per menit per IP | ya | VERIFIED |
| `feed()` | `src/pages/feed.json.ts` | anonim | JSON Feed 1.1, tanpa envelope | **tidak** | route VERIFIED, bentuk ASSUMED |
| `listPosts()` | `src/pages/api/v1/blog/posts/index.ts` | Bearer + tenant + baca `blog_content` | `{posts, nextCursor}` | ya | VERIFIED |
| `registerPush()` | `src/pages/api/v1/push/subscriptions/index.ts` | Bearer + tenant; `transport` `web_push` atau `fcm` | `{subscription}` | ya | VERIFIED |
| `listPush()` | file yang sama, `GET` | Bearer + tenant | daftar | ya | VERIFIED |
| `deletePush()` | `src/pages/api/v1/push/subscriptions/[id].ts` | Bearer + tenant | sukses | ya | VERIFIED |

## Matriks profil awcms-one

Path sumber ada di `ahliweb/awcms-one` pada `66b9985a`, di bawah `apps/cms/src/pages/api/v1/commerce/storefront/` kecuali disebut lain. Sisi klien setiap baris dikunci oleh `packages/client/src/__tests__/commerce.test.ts` dengan fetch yang disuntikkan.

| Operasi (metode klien) | File route | Auth dan tenant | Hasil yang ditangani klien | Di OpenAPI | Kelas |
| --- | --- | --- | --- | --- | --- |
| `requestOtp()` | `account/otp/request.ts` | anonim; tenant dari `Origin` atau Host | 200 `{sent, expiresInSeconds}` (OpenAPI menyebut 202) | ya | VERIFIED, selisih F-05 |
| `verifyOtp()` | `account/otp/verify.ts` | anonim | 200 `{token, expiresAt, account}`; `401 OTP_INVALID`; `404 ACCOUNT_NOT_FOUND`; `403 ACCOUNT_BLOCKED` | ya | VERIFIED |
| `me()` / `updateMe()` | `account/me.ts` | bearer pelanggan `cs_` | `{account}` | ya | VERIFIED |
| `logout()` | `account/logout.ts` | bearer pelanggan | 204; `401 UNAUTHENTICATED` | ya | VERIFIED |
| `orders()` / `order()` | `account/orders/index.ts`, `account/orders/[orderCode].ts` | bearer pelanggan | `{items, nextCursor}`; pesanan | ya | VERIFIED |
| `quoteCart()` | `cart/quote.ts` | anonim | `CartQuote` | ya | VERIFIED |
| `createOrder()` | `orders/index.ts` | anonim atau bearer; body `idempotencyKey` dan header `Idempotency-Key` | 201; 200 saat replay; `409 CART_CHANGED`; `409 IDEMPOTENCY_CONFLICT` | ya | VERIFIED |
| `trackOrder()` | `orders/[orderCode]/index.ts` | anonim, query phone | pesanan | ya | VERIFIED |
| `productIndex()` / `newsIndex()` | `apps/storefront/src/profil/toko/pages/index/produk.json.ts`, `apps/storefront/src/profil/berita/pages/index/berita.json.ts` | file statis storefront, bukan CMS | array mentah | **tidak** | file VERIFIED, bentuk ASSUMED |
| `health()` | `apps/cms/src/pages/api/v1/health.ts` | anonim | objek status | ya | VERIFIED |

## Temuan

| ID | Temuan | Kelas | Pemilik | Issue terkait |
| --- | --- | --- | --- | --- |
| F-01 | Web Push pelanggan kini ada: `account/push/subscriptions` (GET, POST, DELETE) dan `account/push/preferences`, hanya bearer, di balik fitur `customerPush` per tenant yang default-nya mati (404 netral). Transport dikunci `web_push` di server, dan ADR-0048 menolaknya bila storefront dan CMS berbagi satu origin. Tidak ada route untuk token FCM atau APNs native. Gap "tidak ada push pelanggan" di `backend-integration.md` karena itu tertutup sebagian, dan klien belum punya metode untuk route ini. | VERIFIED (source), tidak dijalankan | `awcms-one` untuk route; `awcms-lynx` untuk metode klien apa pun | `awcms-one` #430 (terimplementasi di `b68273fb1`, 2026-10-25, masih terbuka), #431 (storefront browser, bukan native) |
| F-02 | Staf sudah punya "keluar dari semua perangkat lain": `POST /api/v1/auth/sessions/revoke-all`, ditambah `GET` dan `DELETE` di bawah `auth/sessions`. Swalayan, subjeknya bearer, tanpa parameter id, dan menolak token machine-credential. Klien belum punya metodenya. Untuk pelanggan tidak ada route semacam itu. | VERIFIED | `awcms` (staf, selesai); `awcms-one` (pelanggan, terbuka); `awcms-lynx` (metode klien) | tidak ada yang terbuka untuk pelanggan |
| F-03 | Pencarian situs dan `/suggest` menjawab browser lintas-origin (ADR-0107, sejak 2026-08-23) dan menyelesaikan tenant dari `Origin`. Sengaja tanpa handler preflight: request dengan header non-safelisted diblokir. Klien selalu mengirim `X-Correlation-ID`, sehingga panggilan browser langsung dari build Web ke pencarian gagal. `backend-integration.md` menulis resolusi hanya dari Host. | VERIFIED (source dan `http.ts`), tidak dijalankan di browser | `awcms-lynx` (perilaku klien di Web) | `awcms` #1379 (tooling kontrak, cakupan berbeda) |
| F-04 | Preflight commerce hanya mengizinkan `content-type` dan `authorization` (ditambah `idempotency-key` pada route yang dibangun dengan `commerceIdempotentPreflightHeaders`). `X-Correlation-ID` tidak pernah diizinkan. Dengan klien saat ini, mendaftarkan origin web sebagai domain tenant tidak membuat build Web lintas-origin langsung berfungsi, berbeda dari yang ditulis `backend-integration.md`; proxy same-origin berfungsi. | VERIFIED (source), tidak dijalankan di browser | `awcms-lynx` atau `awcms-one` (lihat keputusan D-3) | `awcms-one` #547 (paritas kontrak, cakupan berbeda) |
| F-05 | OpenAPI mendokumentasikan `account/otp/request` sebagai 202; handler mengembalikan 200 lewat `ok()` (komentar header-nya pun menyebut 202). Klien menerima 2xx apa pun sehingga tidak ada efek runtime, tetapi mock yang dibangkitkan dari spec akan menjawab berbeda dari server. | VERIFIED | `awcms-one` | `awcms` #1379 (uji drift), `awcms-one` #547 |
| F-06 | `requestOtp()` mengetik `email` sebagai wajib. Kontrak mengizinkan `via: "whatsapp"` dengan nomor telepon tanpa e-mail untuk login, dan `verifyOtp()` sudah menerima telepon. Masuk lewat WhatsApp saja tidak dapat dimulai dari klien ini. | VERIFIED | `awcms-lynx` | tidak ada |
| F-07 | `feed.json` dan file `/index/*.json` storefront berada di luar OpenAPI. Bentuknya hanya dikunci oleh fixture klien sendiri; perubahan backend tidak akan tertangkap pemeriksaan spec mana pun. | VERIFIED (ketiadaan), bentuk ASSUMED | `awcms` (feed), `awcms-one` (indeks) | `awcms-one` #547 memasukkan indeks statis dalam cakupan |
| F-08 | Login `awcms` juga mengatur cookie sesi di samping bearer di body. Klien native mengabaikannya; build Web yang disajikan same-origin akan menerimanya. Bukan cacat, tetapi profil Web tidak boleh menganggap bearer satu-satunya kredensial. | VERIFIED | tidak ada | tidak ada |

## Gap yang dinilai ulang

| Gap di `backend-integration.md` | Kini | Kelas | Risiko keamanan | Pemilik | Issue yang ada |
| --- | --- | --- | --- | --- | --- |
| Belum ada desain auth staf yang mampu native | Masih terbuka. ADR yang diterima mencakup sign-in OIDC sebagai alur browser yang berakhir pada sesi cookie dan redirect relatif yang divalidasi server (ADR-0028), handoff sekali-pakai untuk BFF Astro (ADR-0050), dan machine credential server-ke-server (ADR-0049, ADR-0092). `awcms` adalah klien OIDC, bukan authorization server. Tidak satu pun mendefinisikan klien publik native. | VERIFIED | Tinggi: sign-in password di perangkat tanpa PKCE, desain pengikatan perangkat, dan pencabutan | `awcms` | tidak ditemukan |
| Tidak ada refresh token staf, sesi 120 menit | Masih terbuka. Login hanya mengembalikan `{token, expiresAt}`. | VERIFIED | Sedang: memaksa memasukkan ulang password, atau menggoda produk menyimpannya | `awcms` | tidak ditemukan |
| Turnstile pada login `full_online` | Masih terbuka. Login menerima `turnstileToken` dan menolak dengan `TURNSTILE_REQUIRED` atau `TURNSTILE_INVALID`; aplikasi native tidak bisa memperoleh token. Apakah sebuah deployment memberlakukannya adalah konfigurasi. | VERIFIED (kode), ASSUMED (per deployment) | Sedang: sign-in native mustahil, atau Turnstile dimatikan | `awcms` | tidak ditemukan |
| Tidak ada baca REST anonim untuk post, halaman, produk | Masih terbuka. Route bernama "public" untuk halaman blog, pengaturan toko, dan voucher dijaga izin baca ("pembangun mengautentikasi diri"); daftar produk juga dijaga izin. Baca anonim yang ada: pencarian situs, `/feed.json`, indeks statis storefront, offering dan ketersediaan booking. | VERIFIED | Rendah: konten datang dari pencarian dan feed | `awcms`, `awcms-one` | tidak ditemukan |
| Tidak ada CORS untuk route staf | Masih benar untuk `auth`, `push`, `blog`, dan API staf lain. Dipersempit oleh ADR-0107 (pencarian situs) dan CORS pada route commerce, newsletter, dan analytics. | VERIFIED | Rendah | `awcms` | tidak ada; sisi klien lihat F-03 dan F-04 |
| Tidak ada push atau pendaftaran perangkat pelanggan | **Tertutup sebagian.** Web Push untuk pelanggan ada (F-01). Token FCM/APNs native untuk pelanggan tidak didukung dan tidak direncanakan di ADR-0048. | ALREADY FIXED (Web Push), DEFERRED (native) | Sedang saat diaktifkan: teks persetujuan perlu tinjauan hukum sebelum produksi (ADR-0048 D8) | `awcms-one` | `awcms-one` #430, #431, #432 |
| Tidak ada "keluar dari semua perangkat" untuk pelanggan | Masih terbuka untuk pelanggan. Logout hanya mencabut sesi ini (dan perangkat push-nya). Staf punya route-nya (F-02). | VERIFIED (pelanggan) | Sedang: perangkat hilang menyimpan sesi sliding 30 hari | `awcms-one` | tidak ditemukan |
| Backend tidak menyajikan file asosiasi deep-link atau app-link | Masih benar. Tidak ada repositori yang menyajikan `apple-app-site-association` atau `assetlinks.json`; satu-satunya kecocokan teks adalah file data arsip lama. | VERIFIED | Rendah sampai sedang: pembajakan tautan mungkin tanpa file asosiasi | repositori produk | tidak ada |

## Kontrol yang diperiksa

| Kontrol | Temuan | Kelas |
| --- | --- | --- |
| Otorisasi berlingkup aktor, swalayan staf | `revoke-all` dibangun dengan `defineSelfServiceTenantRoute`; subjeknya bearer, tanpa parameter id, token machine-credential ditolak. | VERIFIED |
| Otorisasi berlingkup aktor, pelanggan | Route pelanggan menyelesaikan tenant di server (Origin, lalu Host, lalu tenant default hanya bila tidak ada pemanggil lintas-origin) dan menyelesaikan akun dari bearer; logout mencabut sesi beserta perangkat push dalam satu transaksi. Akses pelanggan lain tidak diuji. | VERIFIED (source), tidak dijalankan |
| Penanganan sesi di klien | `401` membersihkan sesi tersimpan hanya bila request yang gagal membawa token terkini, sehingga `401` terlambat tidak dapat mengeluarkan sign-in yang lebih baru. Login gagal tidak membersihkan sesi yang ada. | VERIFIED (tes di `awcms.test.ts`, `commerce.test.ts`) |
| Penyimpanan | Host native: secure store hanya sumber referensi, tidak pernah dikompilasi di sini (PLANNED). Desktop: file app khusus pemilik, issue terbuka #13 dan #14. Web: `localStorage` atau `sessionStorage` dipilih lewat konfigurasi. Putaran ini tidak membaca ulang default Web. | PLANNED (native), kelemahan VERIFIED (desktop), ASSUMED (default Web) |
| CORS | Lihat F-03 dan F-04. Lynx native dan Lynxtron tidak punya CORS. Hanya runtime Web yang terdampak. | VERIFIED (source) |
| PII | Satu-satunya data pribadi yang disimpan adalah objek `account` di dalam rekaman sesi pelanggan. `AwcmsApiError` membawa respons, tidak pernah header request. Tidak ada tes yang mengunci bahwa log atau error tidak memuat token; tidak ditemukan lewat pencarian. | VERIFIED (desain), ASSUMED (tanpa tes kebocoran) |
| Petunjuk tenant dan origin | Klien native boleh mengirim `Origin` (opsi `originHeader` klien). Server memberinya hanya bila itu domain tenant aktif, dan menolak tanpa jatuh ke tenant default. | VERIFIED (source) |

## Apa yang dibuktikan tes

| Lapisan | Isinya | Hasil pada putaran ini |
| --- | --- | --- |
| Unit test klien | 26 referensi ke `fetch` palsu yang disuntikkan di file tes; tidak ada tes yang membuka socket | `bun test packages/client`: 119 lolos, 0 gagal. Mengunci path, header, body, dan pemetaan error; tidak membuktikan apa pun tentang backend live. |
| Platform dan vektor | kontrak host, bridge, dan vektor kontrak untuk host JS (74 menurut `status.md`, tidak dihitung ulang) | `bun test packages/platform`: 24 lolos, 0 gagal; `tests/contract-vectors.test.ts` di dalam run penuh |
| Seluruh workspace | tes kebijakan, cermin, vektor, klien, platform | `bun test`: 375 lolos, 0 gagal, 1826 ekspektasi, 14 file |
| Backend live | tidak ada | Tidak dijalankan. Tes bermock yang lolos tidak boleh dibaca sebagai tes API. |
| Target native | tidak ada | Tidak dijalankan. Host Android, iOS, dan HarmonyOS tetap sumber referensi; tidak ada bukti PoC di repositori ini. |

## Usulan matriks tes consumer-kontrak

Lapisan: C0 unit dengan fetch palsu (ada). C1 kesesuaian spec: request dan fixture klien divalidasi terhadap OpenAPI pada SHA terkunci, tanpa jaringan (belum ada). C2 kontrak live terhadap backend sekali-pakai tiap profil, dengan kasus tenant, auth, dan error (belum ada). C3 menjalankan host di target nyata (belum ada).

| Target | C0 | C1 | C2 | Bukti C3 yang dibutuhkan sebelum klaim apa pun |
| --- | --- | --- | --- | --- |
| Web (browser) | ada | diusulkan | diusulkan, lewat proxy same-origin dan, terpisah, lintas-origin langsung untuk mengamati preflight | log preflight Chromium untuk F-03 dan F-04; Safari dan Firefox |
| Android | ada | dibagi dengan Web | diusulkan | run di perangkat atau emulator, vektor secure-store di JUnit, perilaku petunjuk `Origin`, penanganan 401 |
| iOS | ada | dibagi | diusulkan | run di perangkat atau simulator, vektor Keychain di XCTest, perilaku ATS |
| HarmonyOS | ada | dibagi | diusulkan | run di perangkat, vektor HUKS; ketidakpastian terbesar (`hosts/harmony/README.md`) |
| Desktop (Lynxtron) | ada | dibagi | diusulkan | run berjendela di macOS dan Windows, izin file sesi |

Kasus negatif yang wajib ada di setiap run C2: tenant salah, bearer kedaluwarsa dan dicabut, `409 CART_CHANGED` dan `IDEMPOTENCY_CONFLICT`, `429` dengan `Retry-After`, `TURNSTILE_REQUIRED`, host tak terjangkau, respons tanpa envelope, dan pelanggan membaca kode pesanan pelanggan lain.

## Issue lanjutan yang direkomendasikan

Tidak satu pun boleh dibuka sebelum gerbang 9 lolos di repositori pemiliknya, dan masing-masing harus berukuran S atau M. Ini rekomendasi, bukan komitmen.

| # | Usulan | Repo | Bergantung pada | Catatan duplikasi |
| --- | --- | --- | --- | --- |
| R-1 | Pemeriksaan kesesuaian C1 klien terhadap OpenAPI terkunci | `awcms-lynx` | paket fixture `awcms` #1379 (keputusan D-2); dilacak di #22 | jangan membangun generator mock kedua |
| R-2 | `requestOtp()` menerima login WhatsApp hanya-telepon (F-06) | `awcms-lynx` | tidak ada | tidak ada |
| R-3 | Runtime Web: `X-Correlation-ID` dapat dikonfigurasi atau dihilangkan, atau aturan hanya-proxy yang terdokumentasi (F-03, F-04) | `awcms-lynx` | keputusan D-3 (diambil, ADR-0005); selesai di #21 | tidak ada |
| R-4 | Metode klien untuk keluar-dari-semua-perangkat staf dan preferensi push pelanggan, bila produk membutuhkannya | `awcms-lynx` | R-5, F-01 | jangan membungkus route yang tidak dipakai produk mana pun |
| R-5 | Kode status permintaan OTP: selaraskan OpenAPI dan handler (F-05) | `awcms-one` | tidak ada | tambahkan ke `awcms-one` #547 sebagai komentar, bukan issue baru |
| R-6 | Entri kontrak untuk `feed.json` dan indeks statis (F-07) | `awcms`, `awcms-one` | `awcms` #1379 | tutup di dalam #547 dan #1379 |
| R-7 | ADR untuk autentikasi staf yang mampu native, refresh, dan jalur Turnstile | `awcms` | keputusan pemilik D-1, penerimaan ADR-0146 | belum ada ADR atau issue |
| R-8 | Route keluar-dari-semua-perangkat pelanggan | `awcms-one` | tidak ada | #431 tentang storefront browser, bukan ini |
| R-9 | Push native pelanggan (FCM/APNs) | `awcms-one` | produk yang membutuhkannya | DEFERRED |
| R-10 | File asosiasi untuk deep link | repositori produk | produk dengan domain | bukan pekerjaan template |

Definition of Ready untuk masing-masing: layar atau panggilan ditempatkan di alur, kontrak dan path OpenAPI-nya ada, repositori pemilik disebut, otorisasi per-sumber-daya dinyatakan, dan sebuah tes (C1 atau C2) yang gagal saat drift dijelaskan. R-7 tambahan membutuhkan model ancaman dan tinjauan pelindungan data sebelum gerbang 9 (ADR-0146 §6, butir 6 dan 10).

## Keputusan pemilik

Diambil pemilik pada 20 November 2026 lewat dialog pilihan; tabel di atas bagian ini mencatatnya sebagai terbuka saat riset ditulis. Hanya D-3 yang mengubah repositori ini; D-1 dan D-2 adalah posisi yang dicatat repositori ini.

| ID | Keputusan | Opsi terpilih | Dampak di sini |
| --- | --- | --- | --- |
| D-1 | Menerima ADR-0146 `awcms` (aplikasi persona, masih Proposed di sana) agar R-7 dapat mulai | terima setelah PoC pertama | Tidak ada yang berubah sampai PoC selesai; aplikasi persona tetap di tingkat PoC dan R-7 menunggu |
| D-2 | Tooling kontrak untuk `awcms` #1379 | opsi C′: generator di dalam `awcms`, ditambah paket fixture terpatok yang diterbitkan untuk konsumen (ADR-nya sedang dibuat dan belum bernomor) | Pemeriksaan kesesuaian klien (R-1) akan memakai paket fixture itu; dilacak di #22, menunggu paket dan gerbang 9 |
| D-3 | Di mana F-04 diperbaiki | pertahankan aturan hanya-proxy; `X-Correlation-ID` menjadi opsional di target Web; target native tetap mengirimnya; `awcms-one` tidak diminta mengubah allowlist-nya | Diimplementasikan di #21; dicatat sebagai [ADR-0005](adr/0005-correlation-id-is-optional-on-the-web-target.md) |

D-3 memiliki ADR sendiri karena mengubah perilaku klien dan dipilih di antara opsi dengan dampak keamanan dan kompatibilitas berbeda. D-1 dan D-2 adalah posisi atas keputusan repositori lain dan tidak mengubah kode di sini, sehingga dicatat di tabel ini dan di [`status.md`](status.md), bukan di ADR.

## Reproduce

Semua perintah hanya-baca. `$B` adalah clone backend dengan `origin/main` yang sudah di-fetch.

```text
git -C $B show origin/main:src/modules/_shared/api-response.ts
git -C $B grep -n -i refresh origin/main -- src/pages/api/v1/auth
git -C $B grep -l -i -E "apple-app-site-association|assetlinks\.json" origin/main -- . ':!graphify-out'
git -C $B ls-tree -r --name-only origin/main src/pages/api/v1/auth/sessions
bun install --frozen-lockfile
bun test packages/client
bun test
```

Keberadaan path OpenAPI diperiksa dengan mengekstrak `openapi/awcms-public-api.openapi.yaml` (`awcms`) dan `apps/cms/openapi/awcms-public-api.openapi.yaml` (`awcms-one`) lalu mencocokkan setiap path klien sebagai kunci tingkat atas.
