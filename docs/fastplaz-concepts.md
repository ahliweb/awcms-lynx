# AWCMS-Lynx native-host diagnostics — FastPlaz concepts, repository-specific architecture

## Document control
- **Version:** v1.0.0
- **Updated:** 2026-11-10
- **Status:** Proposed architecture / research only; not a production feature.
- **Document Changeset:** First reference and implementation-boundary mapping.
- **Owning issue:** [#9](https://github.com/ahliweb/awcms-lynx/issues/9).

## Summary and confirmed local baseline
LynxJS/ReactLynx template has typed backend API client, host bridge and tests; web/headless desktop have specific evidence, native Android/iOS/HarmonyOS host proof remains incomplete per `docs/status.md`.

## Intent and candidate adaptation
Define machine-readable local build/test diagnostics per target without changing framework. Preserve Bun workspace plus Node-powered Lynx toolchain.

## Authority and prohibitions
No coding agent in shipped persona application, no fake verified device status, no new mobile feature prior to host-contract ADR, no Rust/Pascal rewrite.

## Existing related issues and anti-duplication
Architecture [#9](https://github.com/ahliweb/awcms-lynx/issues/9).

## Six concrete validation scenarios
1. Web bundle and CSP reported separately from native host.
2. Linux headless desktop success cannot claim signed Windows/macOS release.
3. Android host requires Kotlin/JUnit and actual-device evidence.
4. iOS host requires Swift/XCTest and device evidence.
5. HarmonyOS host requires ArkTS tests/device evidence.
6. Client API logs correlation ID but never bearer token.

## Proposed checks and test evidence
Record target, engine version, platform, command, evidence SHA, and verified/unverified fields. Use `bun run check`, contract vectors, and device verification before claims.

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
- **v1.0.0 — 2026-11-10:** Documented evidence-backed, repo-specific adoption boundary, six practical cases and acceptance rubric.
