---
bump: patch
type: docs
impact: internal
---

# Contract validation of both backends and re-assessment of the persona-app gaps

Issue #19. The backend facts in `docs/backend-integration.md` were a 25 October 2026 snapshot; they were re-read against the current backend sources and the evidence is recorded in `docs/contract-validation-2026-11.md` (with its Indonesian mirror).

- New research page: pinned SHAs of the three repositories, per-operation matrices for both profiles, eight findings, every known gap re-classified (VERIFIED, ASSUMED, PLANNED, DEFERRED, ALREADY FIXED), a controls review, and a proposed contract-consumer test matrix with follow-up issues that wait for gate 9.
- `docs/backend-integration.md`: corrected the site-search tenant rule, the Web CORS consequence (registering the origin as a tenant domain is not enough with the current client), the customer push gap (Web Push now exists) and the staff sign-out-everywhere note.
- `docs/status.md` and `docs/README.md` link the new page. No code, test or API behaviour changed; no live backend and no native target was exercised.
