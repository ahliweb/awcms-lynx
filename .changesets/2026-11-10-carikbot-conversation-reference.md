---
bump: patch
type: docs
impact: internal
---

# Document typed conversation UI as a candidate Lynx capability

Issue #11. Adds an English/Indonesian research reference for safe menu, form, fallback and handoff rendering, platform-specific verification and API security. Concepts only, no source reuse; the response contract is a proposal that waits for gate 9 in this repository.

- New page `docs/carikbot-conversation-reference.md` with its Indonesian mirror (the mirror is a faithful translation with the same heading structure, which `tests/repo-policy.test.ts` enforces); both are listed in `docs/README.md` and `docs/README.id.md`.
- No additional native host implementation, dependency or production behaviour is introduced.
