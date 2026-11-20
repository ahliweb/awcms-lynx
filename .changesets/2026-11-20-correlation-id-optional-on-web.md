---
bump: minor
type: fix
impact: public
---

# X-Correlation-ID is optional on the Web target

Issue #21. The contract validation (#19, finding F-04) showed that a browser preflight refuses `X-Correlation-ID` on the backends' routes, so a Web build could not call them cross-origin. The owner decided on 20 November 2026 to keep the proxy-only rule, make the header optional on Web, and keep it on native targets.

- `ClientConfig.sendCorrelationId` (boolean or function, default `true`). `AwcmsApp` turns it off when `app.info.host` is `web`. Where it is not sent, `AwcmsApiError.correlationId` is the server echo when readable, otherwise `null`.
- Tests: Web without the header, native with it, a late-learned host kind, and the bearer never appearing in errors on either target; one app-level wiring test.
- New [ADR-0005](docs/adr/0005-correlation-id-is-optional-on-the-web-target.md). Owner decisions D-1 (ADR-0146 of `awcms` accepted after the first PoC), D-2 (contract tooling follows `awcms` option C′) and D-3 are recorded, dated, in `docs/contract-validation-2026-11.md` and `docs/status.md`. `docs/security.md`, `docs/backend-integration.md`, `docs/architecture.md` and the client README describe the per-target behaviour; the Indonesian mirrors are updated.
