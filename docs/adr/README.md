# Architecture decision records

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-awcms-lynx-is-the-persona-app-template-repository.md) | awcms-lynx is the separate persona-app template repository for the AWCMS family | Accepted |
| [0002](0002-bun-workspace-with-node-runtime-for-the-lynx-toolchain.md) | Bun manages the workspace; Node.js runs the Lynx toolchain | Accepted |
| [0003](0003-one-host-bridge-contract-for-every-lynx-host.md) | One host-bridge contract for every Lynx host | Accepted |
| [0004](0004-session-tokens-live-in-host-secure-storage.md) | Session tokens live in host secure storage, never in the bundle | Accepted |
| [0005](0005-correlation-id-is-optional-on-the-web-target.md) | `X-Correlation-ID` is optional on the Web target; the proxy-only rule stays | Accepted |
| [0006](0006-android-host-is-a-gradle-project-built-in-ci.md) | The Android host is a Gradle project that CI builds, lints and unit-tests | Proposed |

A new ADR takes the next number, states its context, decision, the options compared (advantages and disadvantages, security, performance, maintainability, scalability, accessibility, SEO, UI/UX, compatibility, operational complexity, long-term implications) and consequences, and is added to this table and to [`README.id.md`](README.id.md) in the same change.
