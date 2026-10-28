---
bump: patch
type: docs
impact: internal
---

# Orchestrator and agent roles in both languages, and a mirror drift guard

The orchestrator/agent section added to `AGENTS.md` (PR #3) was written in Indonesian in the English source and never reached `AGENTS.id.md`, so the two working contracts disagreed. The repository's own convention is an English source with an Indonesian mirror, and nothing caught the gap.

- `AGENTS.md` carries the section in English; `AGENTS.id.md` carries the original Indonesian text; both point to `.claude/agents/`.
- `docs/README.md` (and its mirror) lists `.claude/agents/` under agent instructions.
- `tests/repo-policy.test.ts` now fails when an Indonesian mirror's heading structure differs from its English source.
