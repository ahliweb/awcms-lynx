# ADR-0001 — awcms-lynx is the separate persona-app template repository for the AWCMS family

- **Status:** Accepted
- **Date:** 25 October 2026
- **Decision maker:** ahliweb
- **Related:** ahliweb/awcms ADR-0146 (persona apps prefer Lynx in consumer repos; status Proposed); ahliweb/awcms-one ADR-0050 (LynxJS for separate persona apps; Astro stays for admin and public profiles) and ADR-0024 (template-only ownership); ahliweb/awcms-one ADR-0016 (customer bearer sessions)

## Context

Both backends of the family have already decided *where* a Lynx client may live, and it is not inside them:

- **awcms ADR-0146** makes `persona-app-native` (LynxJS + ReactLynx, preferred candidate) a surface that lives "only in the consumer repo", keeps every admin and public web surface on Astro, and enforces the exclusion mechanically: `tests/product-surface-policy.test.ts` fails if `package.json` declares an `@lynx-js/*` package, if `src/` imports one, or if a `lynx.config.*` exists anywhere in that repository.
- **awcms-one ADR-0050 D3** says persona apps live in separate repositories, outside that workspace; `tests/lynx-direction.test.mjs` fails if a manifest depends on Lynx or a directory under `apps/` matches `lynx`.

What neither repository has is the *starting point* a derived product would copy: a Lynx workspace that already speaks the backend's HTTP contract correctly (envelope, tenant header, idempotency, bearer sessions, error codes), already runs on every Lynx target, and already records the gaps a production app must close.

## Decision

**D1.** `ahliweb/awcms-lynx` is that starting point: a GitHub template repository holding one ReactLynx code base and the hosts that run it — native iOS, Android and HarmonyOS (`hosts/`), Lynx for Web (`apps/web`), and macOS/Windows through Lynxtron (`apps/desktop`).

**D2.** It is a **client only**. It owns no backend, database, migration, secret or tenant. It talks to an `ahliweb/awcms` or `ahliweb/awcms-one` instance owned by the derived product, through that instance's documented API (awcms-one ADR-0050 D4, awcms ADR-0146 §2.1–2.2). It never imports backend source and never holds a provider key or a machine credential.

**D3.** One build targets one backend profile, chosen by `PUBLIC_AWCMS_BACKEND`:

| Profile | Backend | Persona | Sign-in |
| --- | --- | --- | --- |
| `awcms` | ahliweb/awcms | staff / member / field worker | `POST /api/v1/auth/login` → opaque bearer + `X-AWCMS-Tenant-ID`, with MFA and membership selection |
| `awcms-one` | ahliweb/awcms-one | customer | e-mail one-time code → `cs_` bearer session (ADR-0016) |

**D4.** A derived product is created with GitHub's *Use this template*, then owns its copy completely, as awcms-one ADR-0024 requires of products created from a template. This repository must never become the runtime dependency of a product.

**D5.** The ADR-0050 D6 / ADR-0146 §5 proof-of-concept gate is **not** waived by this template. The template makes the PoC cheaper — the API client, host contract and hosts already exist — but every derived product still records its PoC result per target before production. `docs/status.md` lists, target by target, what this repository has verified and what it has not.

## Options considered

| Criterion | Separate template repo (chosen) | Lynx app inside awcms-one | One app per product, no template |
| --- | --- | --- | --- |
| Security | Client-only repo; no backend secret can leak into it | Blocked by ADR-0050 D3 and its guard test | Each team re-derives auth/storage, likely inconsistently |
| Performance | Native rendering per Lynx; measured per product PoC | n/a | Same |
| Maintainability | One reviewed API client and host contract | Mixes Bun-only backend and Node-requiring toolchain | Duplicated per product |
| Scalability | Apps scale independently of the backend | Couples release cycles | Same as chosen, without reuse |
| Accessibility | Shared components carry a11y attributes once | n/a | Per team |
| SEO | Not applicable to persona apps; public SEO stays Astro | n/a | n/a |
| UI/UX | Shared design tokens and screens | n/a | Divergent |
| Compatibility | Five Lynx targets from one source | n/a | Usually only one or two |
| Operational complexity | One more repo, no runtime | Breaks two guard tests | Highest |
| Long term | Upgrades adopted deliberately by each product | Reversal cost high | Drift |

## Consequences

- The backends stay free of Lynx; their guard tests keep passing.
- This repository carries its own toolchain decision (ADR-0002), host contract (ADR-0003) and session-storage policy (ADR-0004).
- Gaps in the backends that block a production persona app (native-capable staff auth, refresh, anonymous catalog API, customer push) are documented in `docs/backend-integration.md` and must be raised as API issues in the backend repositories (ADR-0146 §6.5), not patched around here.
