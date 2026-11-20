# ADR-0005 — `X-Correlation-ID` is optional on the Web target; the proxy-only rule stays

- **Status:** Accepted
- **Date:** 20 November 2026
- **Decision maker:** ahliweb (owner decision D-3, recorded from the contract validation of issue #19)
- **Related:** ADR-0003, ADR-0004; `docs/contract-validation-2026-11.md` F-03, F-04, R-3; `docs/backend-integration.md` §CORS; awcms-one `commerce-cors.ts`

## Context

The client sent `X-Correlation-ID` on every request so a user report could be matched to a server log line. Native Lynx and Lynxtron have no CORS, so the header costs nothing there. A browser is different: a request carrying a header outside the safelist triggers a preflight. The awcms-one commerce routes answer preflights with `content-type` and `authorization` only (plus `idempotency-key` on some routes), the awcms staff routes have no CORS handler, and site search deliberately installs none. Registering the Web origin as a tenant domain therefore does not make a direct cross-origin Web build work (F-04). The awcms-one commerce CORS also exposes only `retry-after` to cross-origin scripts, so the server's echo of the header is unreadable there anyway.

## Decision

**D1.** The same-origin reverse-proxy rule for the Web target stays (`apps/web/deploy/`). The client does not rely on direct cross-origin calls.

**D2.** `X-Correlation-ID` is optional on the Web target: the client does not send it there. `ClientConfig.sendCorrelationId` (boolean or function, default `true`) controls it; the app derives it from the host kind reported by `app.info` (`web` omits the header). Until `app.info` has answered, the native default applies; no API call is made before boot finishes.

**D3.** Native targets (iOS, Android, HarmonyOS, desktop) keep sending the header.

**D4.** Where the header is not sent, `AwcmsApiError.correlationId` is the server's echo when the response header is readable (same-origin proxy), otherwise `null`. A client-made id the server has never seen is never attached to an error.

**D5.** The bearer is never written to errors or logs on either target; tests pin this.

## Options compared

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| A. Omit the header on Web, keep proxy-only (chosen) | Smallest change; no backend edit; no preflight added by this header; native tracing unchanged | Web requests are not traceable by a client-made id; the server logs its own id, readable only through the proxy |
| B. Ask awcms-one to allow `x-correlation-id` in its preflights | Uniform tracing on every target | Backend change in another repository; widens the CORS allowlist; staff routes and site search would still need handlers; slower |
| C. Keep sending everywhere, document the limit | No code change | Direct cross-origin Web calls stay broken; the documented limit is a defect shipped on purpose |

Security: A adds no new allowed header and does not weaken any control; B widens a cross-origin allowlist. Performance: A removes a preflight round trip that would otherwise precede cross-origin calls. Maintainability: one boolean option, tested per target. Scalability and SEO: not affected. Accessibility and UI/UX: no visible change; the error screen shows an id only when one is known. Compatibility: backward compatible for existing callers (default `true`). Operational complexity: none added; the proxy was already required. Long-term: if a backend later allows the header, the Web target can opt in by configuration without a contract change.

## Consequences

- Support reports from the Web build cannot quote a client-made id; the server-side id is available only when the response header is readable.
- `docs/security.md`, `docs/backend-integration.md` and the client README describe the per-target behaviour.
- A product that serves the Web build cross-origin still needs the backend to handle preflights; this ADR does not provide that.
