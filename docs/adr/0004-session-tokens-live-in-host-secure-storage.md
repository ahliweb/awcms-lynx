# ADR-0004 — Session tokens live in host secure storage, never in the bundle

- **Status:** Accepted
- **Date:** 25 October 2026
- **Decision maker:** ahliweb
- **Related:** ADR-0003; awcms ADR-0146 §2.3 (native secrets in secure storage, never localStorage); awcms-one ADR-0016 (customer bearer sessions), ADR-0017 (provider keys stay server-side)

## Context

Both backends issue opaque bearer tokens: awcms staff sessions (120 minutes by default, no refresh, revocable with `POST /api/v1/auth/logout`) and awcms-one customer sessions (`cs_…`, 30 days sliding, revocable with `POST …/account/logout`). Anyone holding the token is the user until it expires or is revoked.

## Decision

**D1.** The client persists exactly one record, key `awcms-lynx:session`, through `secureStorage.set` — Keychain on iOS, Android Keystore-backed AES-GCM on Android, HUKS on HarmonyOS, OS keyring (or an owner-only app file, labelled as such) on desktop, browser storage on the Web.

**D2.** No token, password, OTP or machine credential is ever compiled into a bundle, logged, or passed through `globalProps`. `PUBLIC_*` variables carry only non-secret configuration.

**D3.** Sign-out always clears the local record, even when the server call fails; a `401` from the backend on an authenticated call clears it as well.

**D4.** Staff sessions are dropped locally once `expiresAt` passes (the server does not slide them). Customer sessions are not expired locally, because the server slides them without returning a new `expiresAt`; the client relies on the next `401`.

**D5.** On the Web, the session uses `sessionStorage` for the `awcms` (staff) profile and `localStorage` for `awcms-one` (customer, matching the storefront's own `awcms-one:akun:v1` behaviour), overridable by `PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE`. The settings screen states that the session is kept in the browser profile.

## Consequences

- A product needing stronger guarantees (device binding, refresh rotation, remote revoke of all devices) needs backend work first; see `docs/backend-integration.md` §Gaps.
- Lynx Explorer and unit tests use the in-memory store and must never be used for a production sign-in.
