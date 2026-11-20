# Contract validation of the two backends and persona-app gaps — November 2026

Research record for issue #19, dated 20 November 2026. It re-reads the API that `packages/client` consumes from the backend source, compares it with [`backend-integration.md`](backend-integration.md), re-assesses every documented gap, and proposes a contract-consumer test plan. It changes no code, adds no endpoint and does not claim that any native target works. Decisions it leaves open are listed at the end for the owner.

Position of this work in the development flow (ADR-0156 of `ahliweb/awcms`, the owner's internal cross-portfolio standard): a research input to the contract and Definition of Ready work before gate 9. No implementation issue below may be opened before that gate, and nothing here declares the gate passed. `ahliweb/awcms` ADR-0146 is still **Proposed**, and no accepted ADR admits `awcms-lynx` by name; this page does not state otherwise.

## Scope and method

- In scope: request, response, headers, error envelope, pagination and tenant/origin rules of the operations the client calls, for both profiles; auth, session, CORS, 204, rate limit, idempotency; OpenAPI consistency; host capabilities; the gaps listed in `backend-integration.md`.
- Out of scope: new backend routes, secrets, database work, changes to the upstream API, any statement that a native release passes.
- Method: the backend repositories were read at the pinned commits below with `git show origin/main:<path>` and `git grep`, without checking anything out or modifying them. Route files, OpenAPI paths and handler constants were compared one by one with the client's methods. Tests in this repository were run with Bun 1.4.4.
- Not done, and said so: no request was sent to a running backend, no browser CORS preflight was observed, and no native host was compiled (the environment has a JDK but no Gradle, adb, Xcode or HarmonyOS toolchain). Every "source" finding below is a reading of code, not a recorded exchange.

## Pinned baseline

| Repository | Ref | SHA | Date | Note |
| --- | --- | --- | --- | --- |
| `ahliweb/awcms-lynx` | `main` | `e9c3b22569502fae8202b237f9ca479467d0d765` | 2026-11-07 | the client under test |
| `ahliweb/awcms` | `main` (v10.12.0) | `765e52c7aca35e91a57ed24fc04a035176a32c95` | 2026-11-19 | profile `awcms`; the snapshot cited by `backend-integration.md` was `8ceb80ea34b75ab98f099c5853c8a96f9a3659be` (2026-10-25), an ancestor 159 commits back |
| `ahliweb/awcms-one` | `main` (v0.20.0) | `66b9985ad753d815ad8f85f6392487087f4a8e8f` | 2026-11-19 | profile `awcms-one`; the old snapshot was v0.18.0 (`b6bdbbe90817056193cdd09bb4cd01e92890aa8f`) |
| `awcms` inside `awcms-one` `apps/cms` | subtree merge | `32863de8ccd01071bcf9938739beafd73086eabf` (merge `1e923b184be1582c9916b1ce4f7a20383ee4824d`) | 2026-11-19 | four commits behind `awcms` `main`; none of them touches `src/pages/api` or `src/middleware.ts` |

What changed between the old and the new snapshot, for the files the client depends on: `src/middleware.ts` (HTTP metrics wrapper, auth-page cache headers), `src/lib/security/rate-limit.ts` (warning when several instances run without Redis), `src/lib/security/request-body-limit.ts` (raw-bytes reader added; the 128 KiB default is unchanged), `src/pages/api/v1/site-search/query.ts` (prefix match on the last token). `api-response.ts`, `idempotency-key-bound.ts`, `request-locale.ts` and `auth/login.ts` are unchanged. In `awcms-one`, the customer routes changed in `otp/request.ts`, `otp/verify.ts` and `logout.ts` (issue #513 double-submit safety; push revocation on logout) and `commerce-cors.ts`.

## Classification legend

| Class | Meaning |
| --- | --- |
| VERIFIED | Read in backend source at the pinned SHA and, where the client side matters, pinned by a unit test that passes here. Says nothing about a running deployment. |
| ASSUMED | Believed true from documentation or a comment, not re-read or re-run in this pass. |
| PLANNED | A design or issue exists, or is recommended here, but nothing is implemented. |
| DEFERRED | Intentionally not worked until a product needs it or a gate passes. |
| ALREADY FIXED | A gap recorded earlier that the backend has since closed (at least partly). |
| NOT APPLICABLE | Does not apply to this client. |

## Shared rules re-checked

| Rule | Now | Class | Evidence |
| --- | --- | --- | --- |
| Envelope `{success, data, meta}` / `{success:false, error:{code,message,details?}, meta}` | unchanged; `meta` may carry `correlationId` and `requestId`; helpers produce 200 (`ok`), 201 (`created`), and `fail` | VERIFIED | `awcms` `src/modules/_shared/api-response.ts` |
| `X-Correlation-ID` echoed | unchanged | VERIFIED | `awcms` `src/middleware.ts` lines 49-64 |
| But not readable cross-origin | commerce CORS exposes only `retry-after`; the client falls back to the id it sent | VERIFIED | `awcms-one` `apps/cms/src/modules/commerce/domain/commerce-cors.ts`; `packages/client/src/http.ts` |
| `Idempotency-Key` 1-255 visible ASCII, `400 IDEMPOTENCY_KEY_INVALID` | unchanged; keys are now scoped per actor and the request hash is keyed (ADR-0145) — a client sees no difference | VERIFIED | `awcms` `src/lib/security/idempotency-key-bound.ts`, ADR-0145 |
| 429 + `Retry-After` | unchanged; with `APP_INSTANCE_COUNT` above 1 and no Redis the effective limit is multiplied by the instance count (the deployment's concern, visible only as looser limits) | VERIFIED | `awcms` `src/lib/security/rate-limit.ts` |
| Body limit 128 KiB | unchanged | VERIFIED | `awcms` `src/lib/security/request-body-limit.ts` |
| Staff session TTL 120 min, no refresh | `AUTH_SESSION_TTL_MIN` default 120; no refresh route exists; no sliding extension found (negative search, command in §Reproduce) | VERIFIED | `awcms` `src/modules/identity-access/application/login-policy.ts`; `git grep -i refresh -- src/pages/api/v1/auth` |
| Login limits 20/min per source, 5 failures then 15 min lockout | unchanged | VERIFIED | same file, `DEFAULT_RATE_LIMIT_MAX_ATTEMPTS`, `DEFAULT_MAX_FAILED_ATTEMPTS`, `DEFAULT_LOCKOUT_MINUTES` |
| Customer session 30 days sliding | unchanged; touched at most every 5 minutes | VERIFIED | `awcms-one` `customer-session-token.ts` (`CUSTOMER_SESSION_TTL_SECONDS`), `customer-account-store.ts` (`SESSION_TOUCH_THRESHOLD_SECONDS`) |
| 204 on customer logout | unchanged; logout now also revokes the push devices the session enrolled, in the same transaction | VERIFIED | `awcms-one` `account/logout.ts` |

## Profile awcms matrix

Every row: Bearer is the opaque staff token; tenant header `X-AWCMS-Tenant-ID` where the client sends it; source paths are in `ahliweb/awcms` at `765e52c7`. "In OpenAPI" is the presence of the path in `openapi/awcms-public-api.openapi.yaml` at the same SHA. The client side of every row is pinned by `packages/client/src/__tests__/awcms.test.ts` with an injected fetch.

| Operation (client method) | Route file | Auth and tenant | Outcomes the client handles | In OpenAPI | Class |
| --- | --- | --- | --- | --- | --- |
| `health()` | `src/pages/api/v1/health.ts` | anonymous | `{status, service, runtime, moduleCount, generatedAt}` | yes | VERIFIED |
| `login()` | `src/pages/api/v1/auth/login.ts` | anonymous; tenant optional | 200 `{token, expiresAt}`; `409 MEMBERSHIP_SELECTION_REQUIRED`; `401 MFA_REQUIRED`; `401 MFA_ENROLLMENT_REQUIRED`; `TURNSTILE_REQUIRED` / `TURNSTILE_INVALID`; `401 INVALID_CREDENTIALS`; `429 RATE_LIMITED` | yes | VERIFIED |
| `selectTenant()` | `src/pages/api/v1/auth/session/tenant.ts` | principal token | 200 `{token, expiresAt, tenantId}` | yes | VERIFIED |
| `verifyTotp()` | `src/pages/api/v1/auth/mfa/totp/verify.ts` | MFA challenge token | 200 `{token, expiresAt, assuranceLevel}` | yes | VERIFIED |
| `me()` | `src/pages/api/v1/auth/me.ts` | Bearer + tenant | identity (returns the raw login identifier, no roles) | yes | VERIFIED |
| `session()` | `src/pages/api/v1/auth/session.ts` | Bearer + tenant | roles, assurance, expiry, scopes | yes | VERIFIED |
| `logout()` | `src/pages/api/v1/auth/logout.ts` | Bearer + tenant | success; local session cleared regardless | yes | VERIFIED |
| `siteSearch()` | `src/pages/api/v1/site-search/query.ts` | anonymous; Host-resolved, or `Origin`-resolved when cross-origin (ADR-0107) | `{items, nextCursor, facets, query, locale}`; 60 per minute per IP default | yes | VERIFIED |
| `feed()` | `src/pages/feed.json.ts` | anonymous | JSON Feed 1.1, not enveloped | **no** | VERIFIED route, ASSUMED shape |
| `listPosts()` | `src/pages/api/v1/blog/posts/index.ts` | Bearer + tenant + `blog_content` read | `{posts, nextCursor}` | yes | VERIFIED |
| `registerPush()` | `src/pages/api/v1/push/subscriptions/index.ts` | Bearer + tenant; `transport` `web_push` or `fcm` | `{subscription}` | yes | VERIFIED |
| `listPush()` | same file, `GET` | Bearer + tenant | list | yes | VERIFIED |
| `deletePush()` | `src/pages/api/v1/push/subscriptions/[id].ts` | Bearer + tenant | success | yes | VERIFIED |

## Profile awcms-one matrix

Source paths are in `ahliweb/awcms-one` at `66b9985a`, under `apps/cms/src/pages/api/v1/commerce/storefront/` unless stated. The client side of every row is pinned by `packages/client/src/__tests__/commerce.test.ts` with an injected fetch.

| Operation (client method) | Route file | Auth and tenant | Outcomes the client handles | In OpenAPI | Class |
| --- | --- | --- | --- | --- | --- |
| `requestOtp()` | `account/otp/request.ts` | anonymous; tenant from `Origin` or Host | 200 `{sent, expiresInSeconds}` (OpenAPI says 202) | yes | VERIFIED, drift F-05 |
| `verifyOtp()` | `account/otp/verify.ts` | anonymous | 200 `{token, expiresAt, account}`; `401 OTP_INVALID`; `404 ACCOUNT_NOT_FOUND`; `403 ACCOUNT_BLOCKED` | yes | VERIFIED |
| `me()` / `updateMe()` | `account/me.ts` | customer bearer `cs_` | `{account}` | yes | VERIFIED |
| `logout()` | `account/logout.ts` | customer bearer | 204; `401 UNAUTHENTICATED` | yes | VERIFIED |
| `orders()` / `order()` | `account/orders/index.ts`, `account/orders/[orderCode].ts` | customer bearer | `{items, nextCursor}`; order | yes | VERIFIED |
| `quoteCart()` | `cart/quote.ts` | anonymous | `CartQuote` | yes | VERIFIED |
| `createOrder()` | `orders/index.ts` | anonymous or bearer; body `idempotencyKey` and `Idempotency-Key` header | 201; 200 on replay; `409 CART_CHANGED`; `409 IDEMPOTENCY_CONFLICT` | yes | VERIFIED |
| `trackOrder()` | `orders/[orderCode]/index.ts` | anonymous, phone query | order | yes | VERIFIED |
| `productIndex()` / `newsIndex()` | `apps/storefront/src/profil/toko/pages/index/produk.json.ts`, `apps/storefront/src/profil/berita/pages/index/berita.json.ts` | static files of the storefront, not the CMS | raw arrays | **no** | VERIFIED files, ASSUMED shape |
| `health()` | `apps/cms/src/pages/api/v1/health.ts` | anonymous | status object | yes | VERIFIED |

## Findings

| ID | Finding | Class | Owner | Related issues |
| --- | --- | --- | --- | --- |
| F-01 | Customer Web Push now exists: `account/push/subscriptions` (GET, POST, DELETE) and `account/push/preferences`, bearer only, behind a per-tenant `customerPush` feature that defaults to off (neutral 404). The transport is fixed to `web_push` on the server, and ADR-0048 refuses it when the storefront and the CMS share one origin. There is no route for a native FCM or APNs token. The "no customer push" gap in `backend-integration.md` is therefore partly closed, and the client has no method for these routes. | VERIFIED (source), not executed | `awcms-one` for the routes; `awcms-lynx` for any client method | `awcms-one` #430 (implemented in `b68273fb1`, 2026-10-25, still open), #431 (browser storefront, not native) |
| F-02 | Staff already have "sign out everywhere else": `POST /api/v1/auth/sessions/revoke-all`, plus `GET` and `DELETE` under `auth/sessions`. It is self-service, subject is the bearer, no id parameter, and it refuses machine-credential tokens. The client has no method for it. For customers no such route exists. | VERIFIED | `awcms` (staff, done); `awcms-one` (customer, open); `awcms-lynx` (client method) | none open for customers |
| F-03 | Site search and `/suggest` answer cross-origin browsers (ADR-0107, since 2026-08-23) and resolve the tenant from `Origin`. They install no preflight handler on purpose: a request carrying a non-safelisted header is blocked. The client always sends `X-Correlation-ID`, so a direct browser call from a Web build to search fails. `backend-integration.md` described Host-only resolution. | VERIFIED (source and `http.ts`), not run in a browser | `awcms-lynx` (client behaviour on Web) | `awcms` #1379 (contract tooling, different scope) |
| F-04 | Commerce preflights allow only `content-type` and `authorization` (plus `idempotency-key` on routes built with `commerceIdempotentPreflightHeaders`). `X-Correlation-ID` is never allowed. With the current client, registering the web origin as a tenant domain does not make a direct cross-origin Web build work, contrary to what `backend-integration.md` said; the same-origin proxy does. | VERIFIED (source), not run in a browser | `awcms-lynx` or `awcms-one` (see decision D-3) | `awcms-one` #547 (contract parity, different scope) |
| F-05 | OpenAPI documents `account/otp/request` as 202; the handler returns 200 through `ok()` (its own header comment also says 202). The client accepts any 2xx, so there is no runtime effect, but a spec-generated mock would answer differently from the server. | VERIFIED | `awcms-one` | `awcms` #1379 (drift test), `awcms-one` #547 |
| F-06 | `requestOtp()` types `email` as required. The contract allows `via: "whatsapp"` with a phone and no e-mail for login, and `verifyOtp()` already takes a phone. A WhatsApp-only sign-in cannot be started from this client. | VERIFIED | `awcms-lynx` | none |
| F-07 | `feed.json` and the storefront `/index/*.json` files are outside OpenAPI. Their shape is pinned only by the client's own fixtures; a backend change would not be caught by any spec check. | VERIFIED (absence), shape ASSUMED | `awcms` (feed), `awcms-one` (indexes) | `awcms-one` #547 lists static indexes in scope |
| F-08 | The `awcms` login also sets a session cookie next to the bearer in the body. A native client ignores it; a Web build served same-origin would receive it. Not a defect, but the Web profile must not assume the bearer is the only credential. | VERIFIED | none | none |

## Known gaps re-assessed

| Gap in `backend-integration.md` | Now | Class | Security risk | Owner | Existing issue |
| --- | --- | --- | --- | --- | --- |
| No native-capable staff auth design | Still open. Accepted ADRs cover OIDC sign-in as a browser flow that ends in a cookie session and a server-validated relative redirect (ADR-0028), a single-use handoff for the Astro BFF (ADR-0050) and server-to-server machine credentials (ADR-0049, ADR-0092). `awcms` is an OIDC client, not an authorisation server. None defines a native public client. | VERIFIED | High: password sign-in on a device without PKCE, device binding or revocation design | `awcms` | none found |
| No staff refresh token, 120-minute session | Still open. Login returns `{token, expiresAt}` only. | VERIFIED | Medium: forces re-entry of the password, or tempts a product to store it | `awcms` | none found |
| Turnstile on `full_online` login | Still open. Login accepts `turnstileToken` and refuses with `TURNSTILE_REQUIRED` or `TURNSTILE_INVALID`; a native app cannot obtain a token. Whether a given deployment enforces it is configuration. | VERIFIED (code), ASSUMED (per deployment) | Medium: either native sign-in is impossible or Turnstile is switched off | `awcms` | none found |
| No anonymous REST read of posts, pages, products | Still open. The routes named "public" for blog pages, store settings and vouchers are guarded by a read permission ("the builder authenticates"); product listing is also permission-guarded. Anonymous reads that exist: site search, `/feed.json`, the storefront static index, booking offerings and availability. | VERIFIED | Low: content comes from search and feeds | `awcms`, `awcms-one` | none found |
| No CORS for staff routes | Still true for `auth`, `push`, `blog` and the rest of the staff API. Narrowed by ADR-0107 (site search) and by CORS on commerce, newsletter and analytics routes. | VERIFIED | Low | `awcms` | none; see F-03 and F-04 for the client side |
| No customer push or device registration | **Partly fixed.** Web Push for customers exists (F-01). Native FCM/APNs tokens for customers are not supported and are not planned in ADR-0048. | ALREADY FIXED (Web Push), DEFERRED (native) | Medium when enabled: consent text needs legal review before production (ADR-0048 D8) | `awcms-one` | `awcms-one` #430, #431, #432 |
| No customer "sign out everywhere" | Still open for customers. Logout revokes only this session (and its push devices). Staff have the route (F-02). | VERIFIED (customers) | Medium: a lost device keeps a 30-day sliding session | `awcms-one` | none found |
| No deep-link or app-link association files from the backends | Still true. Neither repository serves `apple-app-site-association` or `assetlinks.json`; the only text match is a legacy archive data file. | VERIFIED | Low to medium: link hijacking is possible without association files | the product repository | none |

## Controls reviewed

| Control | Finding | Class |
| --- | --- | --- |
| Actor-scoped authorisation, staff self-service | `revoke-all` is built with `defineSelfServiceTenantRoute`; the subject is the bearer, there is no id parameter, a machine-credential token is refused. | VERIFIED |
| Actor-scoped authorisation, customer | Customer routes resolve the tenant on the server (Origin, then Host, then the default tenant only when no cross-origin caller is involved) and resolve the account from the bearer; logout revokes the session and its push devices in one transaction. Other-customer access was not exercised. | VERIFIED (source), not executed |
| Session handling in the client | A `401` clears the stored session only if the failing request carried the current token, so a late `401` cannot sign out a newer sign-in. A failed login does not clear an existing session. | VERIFIED (tests in `awcms.test.ts`, `commerce.test.ts`) |
| Storage | Native hosts: secure stores exist as reference sources only, never compiled here (PLANNED). Desktop: owner-only app file, open issues #13 and #14. Web: `localStorage` or `sessionStorage` chosen by configuration. This pass did not re-read the Web default. | PLANNED (native), VERIFIED weakness (desktop), ASSUMED (Web default) |
| CORS | See F-03 and F-04. Native Lynx and Lynxtron have no CORS. Only the Web runtime is affected. | VERIFIED (source) |
| PII | The only persisted personal data is the `account` object inside the customer session record. `AwcmsApiError` carries the response, never the request headers. No test pins that logs or errors exclude the token; none was found by search. | VERIFIED (design), ASSUMED (no leak test) |
| Tenant and origin hint | A native client may send `Origin` (the client's `originHeader` option). The server grants it only if it is an active tenant domain, and refuses without falling back to the default tenant. | VERIFIED (source) |

## What the tests prove

| Layer | What it is | Result in this pass |
| --- | --- | --- |
| Client unit tests | 26 references to an injected fake `fetch` in the test files; no test opens a socket | `bun test packages/client`: 119 pass, 0 fail. They pin paths, headers, bodies and error mapping; they prove nothing about a live backend. |
| Platform and vectors | host contract, bridge, and the contract vectors for the JS hosts (74 according to `status.md`, not recounted) | `bun test packages/platform`: 24 pass, 0 fail; `tests/contract-vectors.test.ts` inside the full run |
| Whole workspace | policy tests, mirrors, vectors, client, platform | `bun test`: 375 pass, 0 fail, 1826 expectations, 14 files |
| Live backend | none | Not run. A passing mocked test must never be read as an API test. |
| Native target | none | Not run. Android, iOS and HarmonyOS hosts remain reference sources; no PoC evidence exists in this repository. |

## Proposed contract-consumer test matrix

Layers: C0 unit with a fake fetch (exists). C1 spec conformance: the client's requests and fixtures validated against the OpenAPI at a pinned SHA, with no network (does not exist). C2 live contract against a disposable backend of each profile, with tenant, auth and error cases (does not exist). C3 host run on a real target (does not exist).

| Target | C0 | C1 | C2 | C3 evidence required before any claim |
| --- | --- | --- | --- | --- |
| Web (browser) | exists | proposed | proposed, through the same-origin proxy and, separately, direct cross-origin to observe the preflight | Chromium preflight log for F-03 and F-04; Safari and Firefox |
| Android | exists | shared with Web | proposed | device or emulator run, secure-store vectors in JUnit, `Origin` hint behaviour, 401 handling |
| iOS | exists | shared | proposed | device or simulator run, Keychain vectors in XCTest, ATS behaviour |
| HarmonyOS | exists | shared | proposed | device run, HUKS vectors; most uncertainty (`hosts/harmony/README.md`) |
| Desktop (Lynxtron) | exists | shared | proposed | windowed run on macOS and Windows, session file permissions |

Negative cases every C2 run must include: wrong tenant, expired and revoked bearer, `409 CART_CHANGED` and `IDEMPOTENCY_CONFLICT`, `429` with `Retry-After`, `TURNSTILE_REQUIRED`, an unreachable host, a response without the envelope, and a customer reading another customer's order code.

## Recommended follow-up issues

None of these may be opened before gate 9 passes in the repository that owns them, and each must be sized S or M. They are recommendations, not commitments.

| # | Proposal | Repo | Depends on | Note on duplicates |
| --- | --- | --- | --- | --- |
| R-1 | C1 conformance check of the client against pinned OpenAPI | `awcms-lynx` | the tooling choice of `awcms` #1379 | do not build a second mock generator |
| R-2 | `requestOtp()` accepts a phone-only WhatsApp login (F-06) | `awcms-lynx` | none | none |
| R-3 | Web runtime: configurable or omitted `X-Correlation-ID`, or documented proxy-only rule (F-03, F-04) | `awcms-lynx` | decision D-3 | none |
| R-4 | Client methods for staff sign-out-everywhere and customer push preferences, if a product needs them | `awcms-lynx` | R-5, F-01 | do not wrap routes no product uses |
| R-5 | OTP request status code: align OpenAPI and handler (F-05) | `awcms-one` | none | add to `awcms-one` #547 as a comment, not a new issue |
| R-6 | Contract entries for `feed.json` and the static indexes (F-07) | `awcms`, `awcms-one` | `awcms` #1379 | cover inside #547 and #1379 |
| R-7 | ADR for native-capable staff authentication, refresh and the Turnstile path | `awcms` | owner decision D-1, ADR-0146 acceptance | no ADR or issue exists |
| R-8 | Customer sign-out-everywhere route | `awcms-one` | none | #431 is about the browser storefront, not this |
| R-9 | Customer native push (FCM/APNs) | `awcms-one` | a product that needs it | DEFERRED |
| R-10 | Association files for deep links | the product repository | a product with a domain | not template work |

Definition of Ready for each: the screen or call is placed in the flow, the contract and its OpenAPI path exist, the owner repository is named, per-resource authorisation is stated, and a test (C1 or C2) that fails on drift is described. R-7 additionally needs a threat model and a data-protection review before gate 9 (ADR-0146 §6, items 6 and 10).

## Decisions waiting for the owner

| ID | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D-1 | Accept ADR-0146 so R-7 can start, or keep persona apps at PoC grade | accept now; accept after a PoC; leave Proposed | accept after the first PoC, so the ADR records evidence |
| D-2 | Which contract-tooling option `awcms` #1379 should choose before R-1 | OpenAPI tool; fixtures; small generator | follow the #1379 research; do not decide here |
| D-3 | Where F-04 is fixed | the client omits the header on Web; `awcms-one` allows `x-correlation-id` in its preflights; keep the proxy-only rule | keep the proxy-only rule now and make the header optional on Web (smallest change, no backend edit) |

## Reproduce

All commands are read-only. `$B` is a clone of the backend, `origin/main` fetched.

```text
git -C $B show origin/main:src/modules/_shared/api-response.ts
git -C $B grep -n -i refresh origin/main -- src/pages/api/v1/auth
git -C $B grep -l -i -E "apple-app-site-association|assetlinks\.json" origin/main -- . ':!graphify-out'
git -C $B ls-tree -r --name-only origin/main src/pages/api/v1/auth/sessions
bun install --frozen-lockfile
bun test packages/client
bun test
```

OpenAPI path presence was checked by extracting `openapi/awcms-public-api.openapi.yaml` (`awcms`) and `apps/cms/openapi/awcms-public-api.openapi.yaml` (`awcms-one`) and matching each client path as a top-level key.
