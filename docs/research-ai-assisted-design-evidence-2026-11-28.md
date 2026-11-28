🇬🇧 English (source) · 🇮🇩 [Bahasa Indonesia](research-ai-assisted-design-evidence-2026-11-28.id.md)

# AI-assisted design and specification evidence — client-only persona template

## Document control
- **Version:** v0.2.0
- **Updated:** 2026-11-28
- **Status:** Research proposal only. Every design item, control, provisional ID and board mapping below is **proposed**; nothing here is a rule in force, a gate decision or permission to implement.
- **Document Changeset:** Taken over from a draft written in another session; claims about this repository re-checked against `main`, references re-checked against their sources, third-party vendor names removed, Indonesian mirror added.
- **Owning issue:** [#27](https://github.com/ahliweb/awcms-lynx/issues/27) (stays open; this page only informs it).
- **Evidence snapshot:** `main` at `371fe3c`; `AGENTS.md` blob `d97c6c85b12e` (a blob prefix, not a commit SHA).

## Research evidence
Rapid review of primary public sources, not a systematic review or a product trial. The research was prompted by the public descriptions of commercial AI-assisted planning and design products in this area. This page uses only general functional concepts and open standards: no code, assets, APIs, text, rules or reverse engineering of any third-party product, and no assessment of any vendor's claims. Vendor feature claims do not demonstrate effectiveness.

- Cui et al. (field experiments on completed tasks, Management Science, [DOI](https://doi.org/10.1287/mnsc.2025.00535)): **not verified at takeover** (publisher page refused access). Year, participant count and effect figures are not stated here.
- [METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/): 16 experienced developers, 246 issues, 19% longer completion time with AI tools; the page itself marks the result as not current. The [2026-02-24 update](https://metr.org/blog/2026-02-24-uplift-update/) reports a changed study design and selection effects. This page's reading, that outcomes differ and no pooled effect or local ROI can be predicted, is an inference, not a quotation.
- [Perry et al.](https://arxiv.org/abs/2211.03622): in a bounded user study, participants with an AI assistant wrote less secure code and were more inclined to believe it was secure.
- [Spec Kit](https://github.com/github/spec-kit): documents clarification and read-only cross-artefact analysis steps, used here as a concept for cross-spec review.
- [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/): Final Community Group Report of 28 Oct 2025, not a W3C Recommendation; used as a vendor-neutral token format reference.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf/publications): version 1.1 final (2022); version 1.2 is a draft (released 2025-12-17).
- [ISO 12207](https://www.iso.org/standard/90219.html) (lifecycle processes), [ISO 9241-210](https://www.iso.org/standard/77520.html) (human-centred design) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/): **not verified at takeover** (the ISO 12207 catalogue page refused access; ISO 9241-210 and WCAG 2.2 were outside the checked set). Edition years from the draft are not repeated as facts.
- Indonesian [personal data protection law](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022) (page opened; article text not read) and [copyright law](https://peraturan.bpk.go.id/Details/38690/uu-no-28-tahun-2014) (**not verified at takeover**): referenced as applicable laws only; no article is quoted.

## Scope and pilot
Lynx client only, no database or server secrets; API and host contracts remain canonical. Read the official Lynx runtime docs and the existing host constraints ([`lynx-runtime.md`](lynx-runtime.md), [`status.md`](status.md)) before a proof of concept.

Proposed pilot: a synthetic approval screen with pending, expired, denied and confirmed states, focus order, accessibility and semantic token mapping across the supported hosts. Distinguish actual device evidence from web emulation; do not claim parity. No backend and no new runtime.

## Evidence contract
Proposed, not in force. Reuse existing requirements, ADRs and canonical artefacts. Trace requirement/acceptance criterion → UI (if applicable) → data/permission/operation → test/evidence; record observed, approved, inferred, unknown and proposed items separately. Pin the actual source SHA before the pilot. Record contextual review, synthetic cases, a baseline and the relevant manual and automated WCAG 2.2 checks; no compliance claim from automation alone. Mark a UI artefact N/A with a reason if this repository has no UI ownership. Measure time including review and rework, cost, defects and security findings, and task success; no invented result. Conflicts return to the owning specification and the applicable gate.

## Safety and ownership
Concept-only, no copying of proprietary code or assets, no new dependency. Minimise context, use synthetic fixtures, least privilege, redaction, and provider and egress approval before any data leaves the machine. No certification claim. This page grants no implementation or architecture approval: issue #27 owns deeper validation, repository-specific CI and review.

## GitHub Projects lifecycle coordination
Direction recorded in issue #27 (2026-11-28): coordinate the applicable steps of the development flow through GitHub Projects (v2), integrated with existing project management, not a second board and not a replacement for repository authority. Everything below is a **proposal**.

- Steps 1–8: track research and specification deliverables, dependency, reviewer, acceptance criteria and evidence URL; no implementation issue before the applicable gate 9. Step 9: the gate tracker references the recorded decision, never one inferred from board stage.
- Steps 10–12: one canonical issue per S/M unit, native parent/sub-issue and blocked-by relations where supported, milestone, priority and assignee preserved; the PR references the issue and CI evidence. Steps 13–15: staging and UAT only if applicable, release-readiness evidence and decision. Steps 16–18: deployment, validation, monitoring and follow-up with release or incident evidence.
- Reuse the approved project and its existing fields; proposed status mapping: Rencana = backlog, Siap = applicable definition of ready, Berjalan = claimed, Menunggu = dependency, review or approval, Selesai = verified outcome, Batal = cancelled with reason. Lifecycle step is separate from stage. A gate rejection stays recorded even if the tracker item is closed. A closed-unmerged PR, a duplicate or not-planned issue, or missing evidence is never marked Selesai automatically. Preserve owner, assignee and target; do not invent deadlines.
- Discover the live project owner, number, access and field IDs; add an existing issue by URL or node ID idempotently, with a dry-run diff, readback and reconcile; keep one canonical issue and tell PR items from work counts. No shared draft cards or confidential context. Review permissions, avoid broad seeding or status-automation conflicts, never move items across visibility boundaries automatically. The board is coordination only, not merge or deploy authority. Project membership was not checked in this research.

References: [planning and tracking with Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects), [using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects), [issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies), [issue statuses](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issue-statuses). These GitHub documentation pages were not re-opened at takeover.

## Reference verification at takeover (2026-11-28)
The draft's references were re-opened read-only on 2026-11-28 (page summaries only; no downloads or logins).

- **Supported (5 sources, 6 pages):** METR 2025 and its 2026 update, Perry et al., Spec Kit, DTCG 2025.10 and NIST SSDF. METR was corrected: it counts 246 *issues*, not tasks, and marks its own result as not current. The personal data protection law page was opened, but its article text was not read.
- **Not verified at takeover (5):** Cui et al. (publisher refused access; every figure attributed to it is removed), ISO 12207, ISO 9241-210, WCAG 2.2 and the copyright law page. Verify them manually before relying on them.
- **Removed:** two commercial product pages and their descriptions, one commercial design-tool format reference, and the assessment of vendor claims (this is a public repository).
- **Test claims:** none are made here. Any test result quoted in the original session belongs to a reference spike outside this repository, was not run here and is not evidence of an implementation.
- **Not done:** no new references were added; the GitHub documentation pages listed above were not re-opened; no CI was run locally (evidence is the GitHub check run after push).

## Changelog
- **v0.2.0 — 2026-11-28:** Takeover: repository claims and references re-checked, figures from unverified sources removed, vendor names neutralised, statuses stated as proposals, Indonesian mirror, index rows and changeset added.
- **v0.1.0 — 2026-11-28:** Initial research draft (written in another session).
