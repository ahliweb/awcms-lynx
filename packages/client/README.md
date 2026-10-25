# @awcms-lynx/client

Typed HTTP client for the two AWCMS backends this template can target:

- **awcms** (`ahliweb/awcms`): the staff / member app (login with optional MFA, site search, feed, blog list, push registration).
- **awcms-one** (`ahliweb/awcms-one`, ADR-0016): the customer commerce app (passwordless OTP sign-in, account, orders, anonymous cart quote and checkout, static catalog index).

One `ClientConfig.backend` value picks which half is live; calling the other half throws `WRONG_BACKEND`.

## Runtime constraints

This code runs in the **Lynx background thread**, not a browser or Node. Available: `fetch`/`Request`/`Response`/`Headers` (no CORS, no `FormData`/`Blob`), `setTimeout`, `Promise`, `console`, `JSON`, `TextEncoder`/`TextDecoder`. Not available, and not used here:

| Missing | What the client does instead |
| --- | --- |
| `URL`, `URLSearchParams` | string join + `encodeURIComponent` (`joinUrl`, `buildQuery`) |
| `AbortController` | feature-detected; the timeout always races a `setTimeout` promise, and aborts too when the controller exists |
| `crypto` | `crypto.getRandomValues` when present, `Math.random` fallback (ids are not secrets) |
| `Intl` | `formatMoney` is string-only |
| Node / DOM APIs, `Buffer` | not used; regexes avoid lookbehind |

Pure ESM TypeScript with `.ts` import extensions (the tsconfig sets `allowImportingTsExtensions`, as the apps do).

## API overview

```ts
import { createAwcmsClient } from '@awcms-lynx/client';

const client = createAwcmsClient(config, secureStore); // secureStore: AsyncKeyValueStore
await client.sessions.load();                          // restores a saved session, drops dead ones
client.sessions.subscribe((session) => { /* route to login when null */ });

// staff
const outcome = await client.awcms.login({ loginIdentifier, password });
// -> signed-in | mfa-required | mfa-enrollment-required | tenant-selection-required | turnstile-required

// customer
await client.commerce.requestOtp({ email, purpose: 'login' });
const session = await client.commerce.verifyOtp({ email, code: '123456', purpose: 'login' });
```

- `createHttpClient(config)`: `request<T>(RequestOptions)`; envelope unwrapping, correlation id, timeout, typed errors.
- `createSessionManager(store)`: persisted session with synchronous `current()` and `subscribe()`.
- `client.awcms` / `client.commerce`: the endpoints below.
- Helpers: `formatMoney`, `snippetToText`, `createRandomId`, `isApiError`.

### Errors

Everything throws `AwcmsApiError { kind, status, code, details?, correlationId, retryAfterSeconds }`.

| kind | when | code |
| --- | --- | --- |
| `http` | non-2xx | backend `error.code`, or `HTTP_<status>` |
| `network` | fetch rejected (status 0) | `NETWORK_ERROR` |
| `timeout` | `timeoutMs` (default 15000) elapsed (status 0) | `TIMEOUT` |
| `envelope` | 2xx but not JSON / not `{success, data}` (status kept) | `BAD_ENVELOPE` |
| `config` | caller mistake, raised before any request | `NOT_SIGNED_IN`, `WRONG_BACKEND`, `STOREFRONT_NOT_CONFIGURED`, `IDEMPOTENCY_KEY_INVALID`, `SEARCH_QUERY_INVALID`, `OTP_*`, `PUSH_KEYS_*`, `MFA_CODE_REQUIRED` |

`correlationId` is the server's echoed `X-Correlation-ID` (falls back to the id the client sent). Tokens are never logged and never stored in errors. Async methods always reject; none throws synchronously.

## Backend facts encoded here

Verified from the backend source.

### Shared envelope (`ahliweb/awcms` `src/modules/_shared/api-response.ts`)

- Success `{ success: true, data, meta: {} }`; error `{ success: false, error: { code, message, details? }, meta: {} }`; 204 has no body. Any 2xx is success (awcms-one's OTP request is documented 202 but returns 200).
- `X-Correlation-ID` is sent per request and echoed. 429 carries `Retry-After` (seconds). Paths are versioned `/api/v1`.
- `Idempotency-Key`: `^[!-~]{1,255}$`, validated client-side before the request.
- Common codes: 401 `AUTH_REQUIRED`, 403 `ACCESS_DENIED`, 400 `VALIDATION_ERROR` / `TENANT_REQUIRED` / `IDEMPOTENCY_KEY_INVALID`, 409 `IDEMPOTENCY_CONFLICT`, 413 `PAYLOAD_TOO_LARGE`, 429 `RATE_LIMITED`.

### awcms (`ahliweb/awcms`)

- Tenant header `X-AWCMS-Tenant-ID` on authenticated calls only (health and site search are anonymous, tenant resolved from Host).
- `POST /api/v1/auth/login` returns an opaque bearer `{ token, expiresAt }`, default TTL 120 min, **no refresh, no sliding**. `load()` therefore drops an expired staff session.
- Branches (modelled as `LoginOutcome`): 409 `MEMBERSHIP_SELECTION_REQUIRED` (then `POST /auth/session/tenant`), 401 `MFA_REQUIRED` (then `POST /auth/mfa/totp/verify`, session becomes `aal2`), 401 `MFA_ENROLLMENT_REQUIRED` (enrol in the web admin), `TURNSTILE_REQUIRED` / `TURNSTILE_INVALID`.
- `GET /auth/me`, `GET /auth/session`, `POST /auth/logout` (local session cleared even if the call fails), `GET /health`.
- `GET /site-search/query?q=&type=&locale=&cursor=` (q max 128, checked client-side). `snippet` is pre-escaped HTML with `<mark>`; use `snippetToText` because Lynx `<text>` cannot render HTML.
- `GET /feed.json?locale=` is JSON Feed 1.1, **not** enveloped.
- `GET /blog/posts?status=published&order=created_at&limit=&cursor=` needs bearer + tenant.
- Push: `POST/GET /push/subscriptions`, `DELETE /push/subscriptions/{id}` (`web_push` requires `keys`, `fcm` forbids them).
- A 401 on a request that carried the staff bearer clears the stored session, then throws.

### awcms-one (`ahliweb/awcms-one`, ADR-0016)

- Account routes under `/api/v1/commerce/storefront/account/`. The server resolves the tenant from `Origin` (browser) or Host / default tenant (native). **No tenant header is ever sent** to these routes. Set `ClientConfig.originHeader` on native builds against a multi-tenant backend.
- OTP request is deliberately neutral (unknown email also "succeeds"). Verify returns `{ token, expiresAt, account }`.
- Token `cs_` + 43 base64url, **30-day sliding** lifetime; `me` returns no new `expiresAt`, so a customer session is never expired locally by `expiresAt`; a 401 `UNAUTHENTICATED` clears it.
- Orders: `GET account/orders?cursor=`, `GET account/orders/{code}`; anonymous `POST cart/quote`, `POST orders` (body `idempotencyKey`, 201 first / 200 replay, optional bearer, 409 `CART_CHANGED` with `details.quote`), `GET orders/{code}?phone=`.
- **The catalog is not an anonymous API.** It is the Astro storefront's static `GET {storefrontOrigin}/index/produk.json` and `/index/berita.json` (raw JSON). With `storefrontOrigin: null` the calls throw `STOREFRONT_NOT_CONFIGURED`.
- Money is always a decimal **string** (`"19999.00"`); `formatMoney` does string arithmetic only.

### Tolerant parsing (backend shape not fully pinned down)

- Order detail: accepts `data.order` or `data` itself. Account: `data.account` or `data`.
- Static index: bare array or `{ items: [...] }`.
- Staff login tenant: from the response `tenantId`, else the header sent, else `GET /auth/session`.
- `SessionIntrospection`, `Order`, `CartQuote`, `BlogPostSummary` carry `[k: string]: unknown` where the contract is open.
- `createOrder` sends the key in both the body (`idempotencyKey`) and the `Idempotency-Key` header, with the same value.

## Known gaps

- **No staff refresh token.** The bearer lives 120 minutes and cannot be extended; the user signs in again. Background features (push, sync) must tolerate that.
- **No native PKCE / OIDC path.** Staff sign-in is login identifier + password (+ TOTP) only; SSO needs a backend route for native clients.
- **No anonymous catalog API** in awcms-one; the app depends on the Astro storefront's static index being deployed and reachable.
- **Turnstile on native.** A native app cannot satisfy Cloudflare Turnstile, so a tenant that enforces it blocks native password login; the client returns `turnstile-required` and the app can only explain it (or the tenant must relax the policy for the app).
- **MFA enrolment** is not implemented (`mfa-enrollment-required` tells the user to enrol in the web admin).
- **CORS for web builds.** Lynx for Web runs in a browser, so the awcms staff routes need a same-origin proxy (or backend CORS allow-listing); native builds are not subject to CORS. The awcms-one routes are designed for browser `Origin`-based tenant resolution.

## Tests

```sh
bun test packages/client          # from the repo root
cd packages/client && bunx tsc -p tsconfig.json
bunx biome check packages/client
```

Tests inject a fake `fetch` (no network) and an in-memory `AsyncKeyValueStore`.
