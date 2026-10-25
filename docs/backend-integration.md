# Backend integration

What the client sends, what it expects back, and what the backends do not offer yet. Every fact cites the backend source it was read from on 25 October 2026 (awcms at `main` 8ceb80e, awcms-one at v0.18.0). When a backend changes, change `packages/client` and this page in the same pull request.

## Shared rules (both backends are awcms)

| Rule | Value | Source |
| --- | --- | --- |
| Version | path `/api/v1`, no version header | awcms `docs/awcms/api-reference.md`, ADR-0008 |
| Success | `{ "success": true, "data": T, "meta": {} }`, any 2xx | awcms `src/modules/_shared/api-response.ts` |
| Error | `{ "success": false, "error": { "code", "message", "details"? }, "meta": {} }` | same |
| No content | `204` with empty body | e.g. awcms-one `…/account/logout.ts` |
| Correlation | client sends `X-Correlation-ID`; server echoes it on every response | awcms `src/middleware.ts` |
| Idempotency | `Idempotency-Key`, 1–255 visible ASCII; same key + same body replays, different body → `409 IDEMPOTENCY_CONFLICT` | awcms `src/lib/security/idempotency-key-bound.ts`, `src/modules/_shared/idempotency.ts` |
| Rate limit | `429 RATE_LIMITED` + `Retry-After` seconds | awcms `src/lib/security/rate-limit.ts` |
| Body limit | 128 KiB default | awcms `src/lib/security/request-body-limit.ts` |
| Locale | `Accept-Language`; error messages stay English, so the app maps `error.code` to its own strings | awcms `src/lib/i18n/request-locale.ts` |

The client turns every failure into `AwcmsApiError { kind: 'http'|'network'|'timeout'|'envelope'|'config', status, code, details, correlationId, retryAfterSeconds }`. `packages/app/src/errors.ts` maps codes to one sentence per locale; the server's English message is never shown.

## Profile `awcms` — staff, members, field workers

**Tenant.** Authenticated routes need `X-AWCMS-Tenant-ID: <uuid>` (awcms `access-guard.ts`). Configure `PUBLIC_AWCMS_TENANT_ID`, or leave it empty and let sign-in ask.

| Client method | Request | Response `data` | Notes |
| --- | --- | --- | --- |
| `health()` | `GET /api/v1/health` | `{status, service, runtime, moduleCount, generatedAt}` | anonymous; also used by the `awcms-one` profile |
| `login()` | `POST /api/v1/auth/login` `{loginIdentifier, password, turnstileToken?}` | `{token, expiresAt}` | opaque bearer, **120 min, no refresh, no sliding** (`AUTH_SESSION_TTL_MIN`) |
| ↳ outcome `tenant-selection-required` | `409 MEMBERSHIP_SELECTION_REQUIRED` `details:{principalToken, expiresAt}` | — | ADR-0088; continue with `selectTenant()` |
| `selectTenant()` | `POST /api/v1/auth/session/tenant` `{principalToken, tenantId}` | `{token, expiresAt, tenantId}` | principal token lives 120 s |
| ↳ outcome `mfa-required` | `401 MFA_REQUIRED` `details:{mfaChallengeToken, expiresAt}` | — | continue with `verifyTotp()` |
| `verifyTotp()` | `POST /api/v1/auth/mfa/totp/verify` `{mfaChallengeToken, code \| recoveryCode}` | `{token, expiresAt, assuranceLevel:'aal2'}` | |
| ↳ outcome `mfa-enrollment-required` | `401 MFA_ENROLLMENT_REQUIRED` | — | enrol in the web admin; not in the app |
| ↳ outcome `turnstile-required` | `TURNSTILE_REQUIRED` / `TURNSTILE_INVALID` | — | a native app cannot pass Turnstile; see Gaps |
| `me()` | `GET /api/v1/auth/me` | `{identityId, loginIdentifier, profileId, status, lastLoginAt}` | |
| `session()` | `GET /api/v1/auth/session` | `{identityId, tenantId, displayName, roles, assuranceLevel, expiresAt, scopes}` | shown on Account |
| `logout()` | `POST /api/v1/auth/logout` | — | local session is cleared even if this fails |
| `siteSearch()` | `GET /api/v1/site-search/query?q&type&locale&cursor` | `{items:[{resourceType, resourceId, url, title, snippet, locale, rank}], nextCursor, facets, query, locale}` | anonymous, tenant from Host, 60/min/IP, `q` ≤ 128; `snippet` is escaped HTML → `snippetToText()` |
| `feed()` | `GET /feed.json?locale` | JSON Feed 1.1 (not enveloped) | the only anonymous post listing |
| `listPosts()` | `GET /api/v1/blog/posts?status=published&order=created_at` | `{posts, nextCursor}` | needs a session with `blog_content` read permission |
| `registerPush()` / `listPush()` / `deletePush()` | `/api/v1/push/subscriptions` `{transport:'fcm'\|'web_push', endpoint, keys?}` | `{subscription}` | any session; iOS goes through FCM (no APNs transport) |

A `401` carrying the stored staff token clears it (only if it is still the current token, so a late `401` cannot sign out a newer session).

## Profile `awcms-one` — customers

**Tenant.** Commerce storefront routes take **no tenant header**. The server resolves the tenant from `Origin` (browser) or, without `Origin` (native), from the Host / default tenant when `PUBLIC_TENANT_RESOLUTION_MODE=host_default`, then `PUBLIC_DEFAULT_TENANT_ID` (awcms-one `apps/cms/src/modules/commerce/application/public-commerce-tenant.ts`, `src/lib/tenant/public-host-tenant-resolver.ts`). A native build against a multi-tenant backend may set the client option `originHeader` to a registered tenant domain.

| Client method | Request (prefix `/api/v1/commerce/storefront/`) | Response `data` | Notes |
| --- | --- | --- | --- |
| `requestOtp()` | `POST account/otp/request` `{email, purpose:'login'\|'register', name?, phone?, via?}` | `{sent, expiresInSeconds:600}` | deliberately neutral; 5/h per address, 10/h per IP |
| `verifyOtp()` | `POST account/otp/verify` `{email \| phone, code, purpose}` | `{token, expiresAt, account}` | `401 OTP_INVALID`, `404 ACCOUNT_NOT_FOUND`, `403 ACCOUNT_BLOCKED` |
| `me()` / `updateMe()` | `GET` / `PATCH account/me` `{name?, marketingConsent?}` | `{account}` | |
| `logout()` | `POST account/logout` | `204` | revokes this session only |
| `orders()` / `order()` | `GET account/orders?cursor`, `GET account/orders/{code}` | `{items, nextCursor}` / order | |
| `quoteCart()` | `POST cart/quote` | `CartQuote` (`canCheckout`, `lines[].status`) | anonymous; the cart itself is client-side only |
| `createOrder()` | `POST orders` with `idempotencyKey` in body **and** `Idempotency-Key` header | order (201, 200 on replay) | `409 CART_CHANGED` carries `details.quote` |
| `trackOrder()` | `GET orders/{code}?phone=` | order | guest tracking |
| `productIndex()` | `GET {storefrontOrigin}/index/produk.json` | `[{id, slug, name, sku, categorySlug, categoryName, price, finalPrice, image:{url,alt}\|null, label, labelColor, rating, sold, stock, inFlashSale}]` | static, from `apps/storefront/src/lib/catalog.ts` |
| `newsIndex()` | `GET {storefrontOrigin}/index/berita.json` | `[{slug, title, excerpt, rubrik, region, date}]` | static |

Customer token: `cs_` + 43 base64url, **30 days sliding** server-side, `me` returns no new `expiresAt` — so the client never expires a customer session locally and relies on `401 UNAUTHENTICATED` (ADR-0016). Money is always a `numeric(14,2)` **string**; `formatMoney()` formats it without floating point or `Intl` (`Rp19.999`, `IDR 19,999`).

## CORS and the three runtimes

| Runtime | CORS applies? | Consequence |
| --- | --- | --- |
| Native Lynx (`fetch` in the Lynx engine) | No — Lynx `fetch` has no CORS ([Lynx fetch docs](https://lynxjs.org/api/lynx-api/global/fetch.html)) | Calls go straight to `PUBLIC_AWCMS_API_BASE_URL` |
| Lynxtron desktop | No (same engine) | Same |
| Lynx for Web (browser) | Yes | awcms staff routes have **no** CORS handler; awcms-one commerce routes allow only registered tenant domains. Serve the web app same-origin with a reverse proxy for `/api` and `/feed.json` (`apps/web/deploy/`), or register the web origin as a tenant domain (awcms-one) |

## Gaps

Each of these blocks a production-grade persona app and belongs to the **backend** repository as an API issue (awcms ADR-0146 §6.5). The template documents and surfaces them; it does not work around them.

| Gap | Effect here | Raise in |
| --- | --- | --- |
| No native-capable staff auth design (OAuth/OIDC + PKCE or an approved application-credential ADR — ADR-0146 §2.3) | Password sign-in works but is a PoC-grade path | ahliweb/awcms |
| No staff refresh token; 120-minute sessions | Staff sign in again every two hours | ahliweb/awcms |
| Turnstile on `full_online` login | Native sign-in impossible when enabled; the app explains it | ahliweb/awcms |
| No anonymous REST read for posts, pages, products | Content comes from `/feed.json`, site search and the storefront's static index | ahliweb/awcms, ahliweb/awcms-one |
| No CORS for staff routes | Web builds need a same-origin proxy | ahliweb/awcms |
| No customer push / device registration (awcms-one ADR-0048 covers Web Push only) | No push for the customer app | ahliweb/awcms-one |
| No customer "sign out everywhere" route | Only the current device can be signed out | ahliweb/awcms-one |
| No deep-link / app-link association files served by the backends | Deep links need product-side setup | product repository |
