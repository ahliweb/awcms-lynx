---
bump: minor
type: structure
impact: public
---

# LynxJS template foundation for awcms and awcms-one backends

The repository becomes the AWCMS family's LynxJS/ReactLynx persona-app template, following awcms ADR-0146 and awcms-one ADR-0050. One ReactLynx codebase can then act as a client for either backend on iOS, Android, HarmonyOS, the web and macOS/Windows.

- Bun workspace with a Node runtime for the Lynx toolchain (ADR-0002).
- `@awcms-lynx/client`: typed HTTP client for awcms staff auth (password, MFA, membership selection) and awcms-one customer OTP sessions.
- `@awcms-lynx/platform`: host-bridge contract (ADR-0003) and runtime config.
- `@awcms-lynx/app`: shared ReactLynx UI in English and Indonesian.
- `apps/mobile` builds `main.lynx.bundle` and `main.web.bundle`.
- `apps/web`: Lynx for Web host.
- `apps/desktop`: Lynxtron host for macOS and Windows.
- Reference native hosts for Android, iOS and HarmonyOS under `hosts/`.
- CI on GitHub Actions.
