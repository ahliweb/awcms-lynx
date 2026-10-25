# ADR-0002 — Bun manages the workspace; Node.js runs the Lynx toolchain

- **Status:** Accepted
- **Date:** 25 October 2026
- **Decision maker:** ahliweb
- **Related:** ADR-0001; awcms ADR-0146 §2.6 (Bun-only applies to AWCMS repositories; Bun support for Lynx to be verified in the consumer repo); awcms-one ADR-0050 D7

## Context

The AWCMS family is Bun-only. Lynx's official tooling states Node.js requirements: Rspeedy/`create-lynx` need Node 20.19+ or 22.12+, Lynxtron needs `^22.18.0 || ^24 || ^26` (lynx-family/lynx-website `docs/en/guide/start/quick-start.mdx`, `docs/en/lynxtron/introduction.mdx`). ADR-0146 asks the consumer repository to verify whether Bun works.

Verified in this repository on 25 October 2026 with Bun 1.4.4 and Node 22.22: `bun install` resolves the Lynx packages with Bun's isolated linker; `bun run build` runs `rspeedy build`, whose bin executes under Node, and produces `main.lynx.bundle` and `main.web.bundle`; `rstest` runs the ReactLynx testing library; `bun test` runs the pure-TypeScript packages.

## Decision

**D1.** Bun is the package manager, lockfile (`bun.lock`) and script runner. No `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock` is committed.

**D2.** Node.js `^22.18.0 || ^24 || ^26` must be installed beside Bun, because Rspeedy, Rsbuild, Rstest and Lynxtron execute under Node. `engines` declares both; `.nvmrc` pins 22.18. This is the ADR-0146 §2.6 "maintainer-approved exception": Node is a *runtime for third-party build tools*, not a second package manager or a runtime for code we ship.

**D3.** Code we write is tested with the runner that matches where it runs: pure TypeScript (`packages/client`, `packages/platform`, `tests/`) with `bun test`; ReactLynx components with Rstest + `@lynx-js/react/testing-library` (the official Lynx path).

## Options considered

| Criterion | Bun + Node runtime (chosen) | Node + pnpm (Lynx upstream default) | Bun only (`bun --bun`) |
| --- | --- | --- | --- |
| Security | One lockfile, Bun's integrity checks | Different lockfile from the family | Untested runtime for the bundler |
| Performance | Fast installs; build speed is Rspack's either way | Same build speed | Unknown |
| Maintainability | Same commands as awcms/awcms-one | Second package manager to learn | Breaks on any Node-only API in Rspeedy/Lynxtron |
| Compatibility | Matches upstream runtime requirements | Best upstream match | Not supported upstream |
| Operational complexity | Two runtimes on CI and dev machines | Two runtimes for family developers too | One runtime but fragile |
| Long term | Drop Node when upstream supports Bun | Diverges from the family | Risky |

## Consequences

- CI installs both Bun and Node (`.github/workflows/ci.yml`).
- If a future Rspeedy/Lynxtron release supports Bun as runtime, D2 is revisited by a new ADR.
