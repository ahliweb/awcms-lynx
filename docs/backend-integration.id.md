🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](backend-integration.md)

# Integrasi backend

Apa yang dikirim klien, apa yang diharapkan kembali, dan apa yang belum ditawarkan oleh backend. Setiap fakta mengutip sumber backend tempat ia dibaca, pada 25 Oktober 2026 (awcms di `main` 8ceb80e, awcms-one di v0.18.0). Ketika backend berubah, ubah `packages/client` dan halaman ini dalam pull request yang sama.

## Aturan bersama (kedua backend adalah awcms)

| Aturan | Nilai | Sumber |
| --- | --- | --- |
| Versi | path `/api/v1`, tanpa header versi | awcms `docs/awcms/api-reference.md`, ADR-0008 |
| Sukses | `{ "success": true, "data": T, "meta": {} }`, status 2xx apa pun | awcms `src/modules/_shared/api-response.ts` |
| Galat | `{ "success": false, "error": { "code", "message", "details"? }, "meta": {} }` | sama |
| Tanpa konten | `204` dengan body kosong | misalnya awcms-one `…/account/logout.ts` |
| Korelasi | klien mengirim `X-Correlation-ID`; server memantulkannya pada setiap respons | awcms `src/middleware.ts` |
| Idempotensi | `Idempotency-Key`, 1–255 karakter ASCII tampak; kunci sama + body sama akan diputar ulang, body berbeda → `409 IDEMPOTENCY_CONFLICT` | awcms `src/lib/security/idempotency-key-bound.ts`, `src/modules/_shared/idempotency.ts` |
| Batas laju | `429 RATE_LIMITED` + `Retry-After` dalam detik | awcms `src/lib/security/rate-limit.ts` |
| Batas body | 128 KiB bawaan | awcms `src/lib/security/request-body-limit.ts` |
| Locale | `Accept-Language`; pesan galat tetap dalam bahasa Inggris, sehingga aplikasi memetakan `error.code` ke string miliknya sendiri | awcms `src/lib/i18n/request-locale.ts` |

Klien mengubah setiap kegagalan menjadi `AwcmsApiError { kind: 'http'|'network'|'timeout'|'envelope'|'config', status, code, details, correlationId, retryAfterSeconds }`. `packages/app/src/errors.ts` memetakan kode ke satu kalimat per locale; pesan bahasa Inggris dari server tidak pernah ditampilkan.

## Profil `awcms` — staf, anggota, pekerja lapangan

**Tenant.** Rute yang memerlukan autentikasi membutuhkan `X-AWCMS-Tenant-ID: <uuid>` (awcms `access-guard.ts`). Konfigurasikan `PUBLIC_AWCMS_TENANT_ID`, atau biarkan kosong dan biarkan proses masuk yang memintanya.

| Metode klien | Permintaan | `data` respons | Catatan |
| --- | --- | --- | --- |
| `health()` | `GET /api/v1/health` | `{status, service, runtime, moduleCount, generatedAt}` | anonim; juga dipakai oleh profil `awcms-one` |
| `login()` | `POST /api/v1/auth/login` `{loginIdentifier, password, turnstileToken?}` | `{token, expiresAt}` | bearer opaque, **120 menit, tanpa refresh, tanpa masa berlaku geser** (`AUTH_SESSION_TTL_MIN`) |
| ↳ hasil `tenant-selection-required` | `409 MEMBERSHIP_SELECTION_REQUIRED` `details:{principalToken, expiresAt}` | — | ADR-0088; lanjutkan dengan `selectTenant()` |
| `selectTenant()` | `POST /api/v1/auth/session/tenant` `{principalToken, tenantId}` | `{token, expiresAt, tenantId}` | principal token berlaku 120 detik |
| ↳ hasil `mfa-required` | `401 MFA_REQUIRED` `details:{mfaChallengeToken, expiresAt}` | — | lanjutkan dengan `verifyTotp()` |
| `verifyTotp()` | `POST /api/v1/auth/mfa/totp/verify` `{mfaChallengeToken, code \| recoveryCode}` | `{token, expiresAt, assuranceLevel:'aal2'}` | |
| ↳ hasil `mfa-enrollment-required` | `401 MFA_ENROLLMENT_REQUIRED` | — | daftarkan MFA di admin web; tidak di aplikasi |
| ↳ hasil `turnstile-required` | `TURNSTILE_REQUIRED` / `TURNSTILE_INVALID` | — | aplikasi native tidak dapat melewati Turnstile; lihat Kekurangan |
| `me()` | `GET /api/v1/auth/me` | `{identityId, loginIdentifier, profileId, status, lastLoginAt}` | |
| `session()` | `GET /api/v1/auth/session` | `{identityId, tenantId, displayName, roles, assuranceLevel, expiresAt, scopes}` | ditampilkan di Account |
| `logout()` | `POST /api/v1/auth/logout` | — | sesi lokal tetap dihapus meskipun ini gagal |
| `siteSearch()` | `GET /api/v1/site-search/query?q&type&locale&cursor` | `{items:[{resourceType, resourceId, url, title, snippet, locale, rank}], nextCursor, facets, query, locale}` | anonim, tenant dari Host, 60/menit/IP, `q` ≤ 128; `snippet` berupa HTML ter-escape → `snippetToText()` |
| `feed()` | `GET /feed.json?locale` | JSON Feed 1.1 (tanpa envelope) | satu-satunya daftar postingan anonim |
| `listPosts()` | `GET /api/v1/blog/posts?status=published&order=created_at` | `{posts, nextCursor}` | memerlukan sesi dengan izin baca `blog_content` |
| `registerPush()` / `listPush()` / `deletePush()` | `/api/v1/push/subscriptions` `{transport:'fcm'\|'web_push', endpoint, keys?}` | `{subscription}` | sesi apa pun; iOS melalui FCM (tidak ada transport APNs) |

Respons `401` yang membawa token staf tersimpan akan menghapusnya — hanya jika itu masih token yang aktif, sehingga `401` yang terlambat tidak dapat mengeluarkan sesi yang lebih baru.

## Profil `awcms-one` — pelanggan

**Tenant.** Rute storefront commerce tidak menerima header tenant. Server menentukan tenant dari `Origin` (peramban) atau, tanpa `Origin` (native), dari Host / tenant default ketika `PUBLIC_TENANT_RESOLUTION_MODE=host_default`, lalu `PUBLIC_DEFAULT_TENANT_ID` (awcms-one `apps/cms/src/modules/commerce/application/public-commerce-tenant.ts`, `src/lib/tenant/public-host-tenant-resolver.ts`). Build native yang ditujukan ke backend multi-tenant dapat mengatur opsi klien `originHeader` ke domain tenant yang terdaftar.

| Metode klien | Permintaan (prefiks `/api/v1/commerce/storefront/`) | `data` respons | Catatan |
| --- | --- | --- | --- |
| `requestOtp()` | `POST account/otp/request` `{email, purpose:'login'\|'register', name?, phone?, via?}` | `{sent, expiresInSeconds:600}` | sengaja netral; 5/jam per alamat, 10/jam per IP |
| `verifyOtp()` | `POST account/otp/verify` `{email \| phone, code, purpose}` | `{token, expiresAt, account}` | `401 OTP_INVALID`, `404 ACCOUNT_NOT_FOUND`, `403 ACCOUNT_BLOCKED` |
| `me()` / `updateMe()` | `GET` / `PATCH account/me` `{name?, marketingConsent?}` | `{account}` | |
| `logout()` | `POST account/logout` | `204` | hanya mencabut sesi ini |
| `orders()` / `order()` | `GET account/orders?cursor`, `GET account/orders/{code}` | `{items, nextCursor}` / pesanan | |
| `quoteCart()` | `POST cart/quote` | `CartQuote` (`canCheckout`, `lines[].status`) | anonim; keranjang itu sendiri hanya ada di sisi klien |
| `createOrder()` | `POST orders` dengan `idempotencyKey` di body **dan** header `Idempotency-Key` | pesanan (201, 200 saat diputar ulang) | `409 CART_CHANGED` membawa `details.quote` |
| `trackOrder()` | `GET orders/{code}?phone=` | pesanan | pelacakan tamu |
| `productIndex()` | `GET {storefrontOrigin}/index/produk.json` | `[{id, slug, name, sku, categorySlug, categoryName, price, finalPrice, image:{url,alt}\|null, label, labelColor, rating, sold, stock, inFlashSale}]` | statis, dari `apps/storefront/src/lib/catalog.ts` |
| `newsIndex()` | `GET {storefrontOrigin}/index/berita.json` | `[{slug, title, excerpt, rubrik, region, date}]` | statis |

Token pelanggan: `cs_` + 43 base64url, **masa berlaku geser 30 hari** di sisi server, dan `me` tidak mengembalikan `expiresAt` baru — sehingga klien tidak pernah membatalkan sesi pelanggan secara lokal dan mengandalkan `401 UNAUTHENTICATED` (ADR-0016). Uang selalu berupa string `numeric(14,2)`; `formatMoney()` memformatnya tanpa floating point atau `Intl` (`Rp19.999`, `IDR 19,999`).

## CORS dan tiga runtime

| Runtime | CORS berlaku? | Konsekuensi |
| --- | --- | --- |
| Lynx native (`fetch` di engine Lynx) | Tidak — `fetch` Lynx tidak memiliki CORS ([dokumentasi fetch Lynx](https://lynxjs.org/api/lynx-api/global/fetch.html)) | Panggilan langsung ke `PUBLIC_AWCMS_API_BASE_URL` |
| Desktop Lynxtron | Tidak (engine yang sama) | Sama |
| Lynx for Web (peramban) | Ya | Rute staf awcms **tidak** memiliki handler CORS; rute commerce awcms-one hanya mengizinkan domain tenant yang terdaftar. Sajikan aplikasi web dengan origin yang sama melalui reverse proxy untuk `/api` dan `/feed.json` (`apps/web/deploy/`), atau daftarkan origin web sebagai domain tenant (awcms-one) |

## Kekurangan

Setiap hal berikut menghambat aplikasi persona yang siap produksi, dan termasuk dalam repositori **backend** sebagai isu API (awcms ADR-0146 §6.5). Templat ini mendokumentasikan dan menampilkannya; templat ini tidak mengakalinya.

| Kekurangan | Dampak di sini | Ajukan di |
| --- | --- | --- |
| Belum ada desain autentikasi staf yang mendukung native (OAuth/OIDC + PKCE atau ADR kredensial aplikasi yang disetujui — ADR-0146 §2.3) | Masuk dengan kata sandi berfungsi, tetapi hanya berstatus jalur kelas PoC | ahliweb/awcms |
| Belum ada refresh token staf; sesi 120 menit | Staf harus masuk kembali setiap dua jam | ahliweb/awcms |
| Turnstile pada login `full_online` | Masuk native tidak mungkin saat diaktifkan; aplikasi menjelaskannya | ahliweb/awcms |
| Belum ada pembacaan REST anonim untuk postingan, halaman, produk | Konten berasal dari `/feed.json`, pencarian situs, dan indeks statis storefront | ahliweb/awcms, ahliweb/awcms-one |
| Tidak ada CORS untuk rute staf | Build web memerlukan proxy dengan origin yang sama | ahliweb/awcms |
| Belum ada push / registrasi perangkat untuk pelanggan (ADR-0048 awcms-one hanya mencakup Web Push) | Tidak ada push untuk aplikasi pelanggan | ahliweb/awcms-one |
| Belum ada rute "keluar dari semua perangkat" untuk pelanggan | Hanya perangkat saat ini yang dapat dikeluarkan | ahliweb/awcms-one |
| Belum ada berkas asosiasi deep-link / app-link yang disajikan oleh backend | Deep link memerlukan penyiapan di sisi produk | repositori produk |
