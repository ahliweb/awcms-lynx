# AWCMS-Lynx native-host diagnostics — FastPlaz concepts, repository-specific architecture

## Document control
- **Version:** v1.1.0
- **Updated:** 2026-11-20
- **Status:** Proposed architecture / research only; not a production feature. Every adoption below is a proposal until gate 9 (cross-spec Definition of Ready) in this repository; nothing here is a decision.
- **Document Changeset:** Re-checked against `main` after the 20 November 2026 contract validation: status sources, anti-duplication links and the correlation-ID wording corrected; Indonesian mirror added.
- **Owning issue:** [#9](https://github.com/ahliweb/awcms-lynx/issues/9).

## Summary and confirmed local baseline
LynxJS/ReactLynx template has a typed backend API client, a host bridge and tests. Per [`status.md`](status.md), the Lynx bundle, the Web host (Chromium under the production CSP) and the headless desktop run have specific evidence; the Android, iOS and HarmonyOS hosts are reference sources that have not been compiled or run on a device. [`contract-validation-2026-11.md`](contract-validation-2026-11.md) adds that no test here has touched a live backend.

## Intent and candidate adaptation
Define machine-readable local build/test diagnostics per target without changing framework. Preserve the Bun workspace plus Node-powered Lynx toolchain ([ADR-0002](adr/0002-bun-workspace-with-node-runtime-for-the-lynx-toolchain.md)).

## Authority and prohibitions
No coding agent in the shipped persona application, no fake verified device status, no new host capability before a host-contract ADR (see [ADR-0003](adr/0003-one-host-bridge-contract-for-every-lynx-host.md)), no Rust/Pascal rewrite.

## Existing related issues and anti-duplication
This page does not implement anything tracked elsewhere; the work below already has an owner:

- Contract and gap evidence: [#19](https://github.com/ahliweb/awcms-lynx/issues/19) (closed), recorded in [`contract-validation-2026-11.md`](contract-validation-2026-11.md).
- Web host CSP: [#16](https://github.com/ahliweb/awcms-lynx/issues/16).
- Desktop signing and provenance: [#17](https://github.com/ahliweb/awcms-lynx/issues/17); desktop session storage: [#13](https://github.com/ahliweb/awcms-lynx/issues/13) and [#14](https://github.com/ahliweb/awcms-lynx/issues/14).
- CI hardening and SBOM: [#15](https://github.com/ahliweb/awcms-lynx/issues/15).

## Six concrete validation scenarios
1. Web bundle and CSP reported separately from native host.
2. Linux headless desktop success cannot claim signed Windows/macOS release.
3. Android host requires Kotlin/JUnit and actual-device evidence.
4. iOS host requires Swift/XCTest and device evidence.
5. HarmonyOS host requires ArkTS tests/device evidence.
6. The client sends an `X-Correlation-ID` on every call and never logs the session bearer ([`security.md`](security.md)).

## Proposed checks and test evidence
Record target, engine version, platform, command, evidence SHA, and verified/unverified fields. Use `bun run check`, the contract vectors (`tests/contract-vectors.test.ts`), and device verification before claims. [`status.md`](status.md) stays the verification source.

## Rollout / handoff
Document local test adapter mapping and wait for consumer-host PoC; no global agent daemon.

## Source reference and limits
This document takes **concepts only** from [FastPlaz](https://github.com/fastplaz/fastplaz): [MCP/AI Agent Plane](https://github.com/fastplaz/fastplaz/blob/master/docs/MCP.md), [IDE workflow](https://github.com/fastplaz/fastplaz/blob/master/docs/AI_AGENT_by_FASTPLAZ.md), and [standalone operator concepts](https://github.com/fastplaz/fastplaz/blob/master/docs/STANDALONE-deployment.md). No Pascal, Lazarus, CGI, MVC/theme engine, or source-code copying. [FastPlaz license text](https://github.com/fastplaz/fastplaz/blob/master/LICENSE.txt) does not demonstrate explicit source-code permissions; independent implementation only.

## Cross-portfolio engineering invariants
Applies the **internal cross-portfolio standard**, alongside this repository's own AGENTS, ADR, CONTRIBUTING and current code reality. Human-approved **Gate 9 (cross-spec Definition of Ready)** precedes production feature code; human-approved **Gate 15 (release readiness)** precedes production. One issue/branch/PR per atomic scope. Never present a specification, green documentation check, or research as working production functionality.

Local MCP/tool connector, if ever required: loopback or authenticated IPC, host/Origin restrictions for HTTP, rotating scoped credentials, canonical-path and symlink protections, read/write/destructive approval tiers, no arbitrary shell, no default SQL/raw DB/secret access, bounded resource/time/cancellation, policy at actual tool/OS runtime, fail-closed unknown and redacted logs. Human sign-off for changes to authorization, production configuration or sensitive data.

## Relevant regulatory and control references
Evaluate applicability, not compliance by assertion: Indonesian UU 27/2022 (PDP), PP 71/2019 (PSTE), Perpres 95/2018 where SPBE applies; ISO/IEC 27001, 27002, 27005, 27017, 27018, 27034, 27701, ISO 22301, ISO/IEC 20000-1, ISO/IEC 42001, ISO/IEC 15408; OWASP LLM/Agentic Security, NIST AI RMF. Obtain independent control evidence and applicable edition before any claim of certification.

## Acceptance evidence rubric
For any follow-on: link spec/ADR and owning issue; record source commit, toolchain/runtime version, commands executed, actual error/result, denied access tests and evidence SHA. Mark unrun checks **NOT EXECUTED**. Approvals and publication/deployment status are distinct. No sensitive personal data or production secrets in prompts, logs or GitHub artifacts.


## Changelog
- **v1.1.0 — 2026-11-20:** Re-checked against `main`: status wording aligned with `status.md`, related issues linked instead of self-reference, correlation-ID wording corrected, ADR links added, proposal status stated, Indonesian mirror added.
- **v1.0.0 — 2026-11-10:** Documented evidence-backed, repo-specific adoption boundary, six practical cases and acceptance rubric.
