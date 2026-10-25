# Security and privacy

Threat model, controls, and the standards they answer to. The backend is the security boundary — authorization, tenant isolation (row-level security), rate limiting and audit all happen there; this client must not weaken them and must protect what it holds: a session token and personal data on screen.

## Assets and threats

| Asset | Threat | Control in this repository |
| --- | --- | --- |
| Session bearer (`awcms` staff / `cs_` customer) | Theft from device storage, logs, crash reports, backups | Stored only through `secureStorage` (Keychain, Keystore AES-GCM, HUKS, OS keyring) — ADR-0004; never logged; never in `globalProps` or `PUBLIC_*` |
| Session bearer | Use after sign-out | `logout()` revokes server-side and always clears locally; a `401` clears it |
| Backend secrets (machine credentials, provider keys) | Shipped inside a bundle | Not supported by design: `PUBLIC_*` only; the catalog uses the public storefront index instead of a machine token (`docs/backend-integration.md`) |
| Other tenants' / users' data (BOLA/IDOR) | Client sends another id | The backend enforces ABAC + RLS on every request; the client never decides access |
| Host capabilities | A compromised bundle opens `javascript:`/`intent:` URLs or reads other keys | Hosts re-validate: key namespace `awcms-lynx:*`, value ≤ 16 KiB, `link.open` http/https only (ADR-0003 D3) |
| Transport | Interception | `normaliseBaseUrl` refuses non-https except loopback/private LAN; native hosts keep platform TLS defaults (ATS, Network Security Config) |
| Rendering injected markup | XSS through search snippets | Lynx `<text>` renders text, not HTML; `snippetToText()` strips tags and decodes entities |
| Web host | XSS stealing the browser-stored session | CSP and security headers in `apps/web/deploy/`; `sessionStorage` by default for staff; same-origin API |
| Abuse | Credential stuffing, OTP brute force | Server-side limits (login 20/min, OTP 5/h); the app shows `Retry-After` |

## Rules for contributors

1. Never add a secret to a bundle, a `PUBLIC_` variable, `globalProps`, a test fixture that looks real, or a log line.
2. Never decide authorization in the UI. Hiding a button is UX; the server's `403` is the control.
3. Never render server-provided HTML. Convert to text.
4. A new host capability is a contract change (ADR-0003 D5) with validation on both sides and test vectors.
5. A new backend call goes through `packages/client`, never a raw `fetch` in a screen.
6. Personal data (name, e-mail, phone, orders) is shown, not stored: the only persisted personal data is the `account` inside the customer session record.

## Standards mapping

| Standard / regulation | What it asks | Where this repository answers |
| --- | --- | --- |
| OWASP MASVS v2 — STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE | Sensitive data in platform secure storage; TLS; platform interaction validated | ADR-0004; `hosts/` secure stores; host-side validation; `normaliseBaseUrl` |
| OWASP ASVS 4.0 (V3 sessions, V8 data protection, V14 config) | Revocation, no secrets in client, hardened headers | logout semantics, `PUBLIC_*` rule, `apps/web/deploy/` headers |
| ISO/IEC 27001:2022 + 27002:2022 (A.5.15 access control, A.8.24 cryptography, A.8.25–8.28 secure development, A.8.9 configuration) | Documented controls and secure SDLC | this page, ADRs, CI gates (`bun run check`), code review |
| ISO/IEC 27005:2022 | Risk-based treatment | "Assets and threats" table; gaps recorded in `docs/backend-integration.md` |
| ISO/IEC 27034 (application security) | Application security controls tied to the lifecycle | contract tests, lint rules forbidding `any`/non-null assertions, threat table per feature |
| ISO/IEC 27701:2019 / 27018:2019 | PII minimisation and processing transparency | no PII cache beyond the session record; no analytics SDK in the template |
| ISO/IEC 27017:2015 | Cloud customer/provider responsibilities | the backend and its hosting belong to the derived product (ADR-0001 D2) |
| ISO/IEC 15408 (Common Criteria) | Evaluated security functions | not claimed; a product needing certification evaluates its own build |
| ISO/IEC 22301:2019 | Continuity | client has no state of record; the backend's continuity plan applies |
| ISO/IEC 20000-1:2018 | Service management | release notes from changesets; versioned, tagged releases |
| UU No. 27/2022 (Pelindungan Data Pribadi) and PP No. 71/2019 (PSTE) | Lawful processing, security of personal data, breach duty, data-subject rights | data minimisation above; account data comes from and is corrected in the backend; a product processing sensitive data runs a DPIA (ADR-0146 §2.8) |

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md).
