🇬🇧 English (source) · 🇮🇩 [Bahasa Indonesia](AGENTS.id.md)

# AGENTS.md — awcms-lynx working contract

Applies to people and AI agents alike. Read it before changing anything.

## What this repository is

The AWCMS family's LynxJS/ReactLynx **client** template ([ADR-0001](docs/adr/0001-awcms-lynx-is-the-persona-app-template-repository.md)). It has no backend, database or secrets. It talks to an `ahliweb/awcms` (profile `awcms`, staff) or `ahliweb/awcms-one` (profile `awcms-one`, customers) instance through the documented API in [`docs/backend-integration.md`](docs/backend-integration.md).

Before any Lynx task, read the Lynx index: <https://lynxjs.org/llms.txt> (the official agent entry point), then [`docs/lynx-runtime.md`](docs/lynx-runtime.md) for the facts this repository depends on.

## Commands

| Command | What |
| --- | --- |
| `bun install` | install (Bun 1.4.4+; Node 22.18+ must also be present — ADR-0002) |
| `bun run dev` / `dev:web` / `dev:desktop` | develop on Explorer / browser / desktop |
| `bun run check` | lint + type-check + `bun test` + UI tests + builds — must be green before a PR |
| `bun test` | pure-TS tests (client, platform, hosts' TS, `tests/`) |
| `bun run test:ui` | ReactLynx tests (Rstest) |
| `bun run release` | preview the next version from `.changesets/` |

## Non-negotiable rules

1. **Client only.** No backend code, no database, no server secret, no machine credential, no provider key — in code, `PUBLIC_*` variables, `globalProps`, fixtures or logs ([`docs/security.md`](docs/security.md)).
2. **Backend calls go through `packages/client`.** No `fetch` in a screen. Every new call gets a test that pins path, headers and body, and a row in `docs/backend-integration.md` citing the backend source file.
3. **Background-thread code uses no `URL`, `URLSearchParams`, `crypto`, `Intl`, `Buffer`, DOM or Node API** (`packages/client`, `packages/platform/src/{bridge,contract,runtime-config}.ts`, `packages/app`). `tests/repo-policy.test.ts` enforces it.
4. **Host capabilities go through the contract** (`packages/platform/src/contract.ts`, ADR-0003). Adding a method bumps `HOST_BRIDGE_VERSION` and updates every host and `hosts/contract-test-vectors.json` in the same change.
5. **Authorization is the server's.** The UI may hide; it never decides.
6. **Never render server HTML.** Convert with `snippetToText()` or similar.
7. **Strings in both locales** (`packages/app/src/i18n.ts`); Indonesian is the default.
8. **Generic helpers are `function name<T>()`,** not `<T>() =>` arrows — the ReactLynx test transform parses `.ts` as TSX.
9. **Honesty over polish.** Settings must state the real session storage; docs must describe what is verified, not what is planned ([`docs/status.md`](docs/status.md)).
10. **Backend gaps are raised upstream**, not worked around here ([`docs/backend-integration.md` §Gaps](docs/backend-integration.md#gaps)).

## Layout and ownership

| Path | Owns | Must not |
| --- | --- | --- |
| `packages/client` | HTTP contract of both backends | depend on Lynx or the DOM |
| `packages/platform` | host contract, bridge adapter, runtime config, browser host handler | depend on the app or client |
| `packages/app` | screens, components, i18n, tokens, `startApp()` | call `NativeModules` or `fetch` directly |
| `apps/mobile` | Lynx + Web bundles, UI tests | contain screens |
| `apps/web` | `<lynx-view>` page, dev proxy, deploy examples | contain screens |
| `apps/desktop` | Lynxtron main process + desktop bundle | expose Node to the UI beyond the contract |
| `hosts/` | reference native hosts | be described as compiled or verified unless a PoC did so |

## Definition of Done

- [ ] Atomic change, independently verifiable; scope stays inside the workspaces it is about.
- [ ] `bun run check` green.
- [ ] Tests added or updated for the behaviour.
- [ ] Docs updated in the same change (English source + `.id.md` mirror for README/AGENTS/docs pages).
- [ ] Changeset added when public behaviour, structure, dependencies or deployment change.
- [ ] Trade-off decisions recorded as an ADR (advantages/disadvantages, security, performance, maintainability, scalability, accessibility, SEO, UI/UX, compatibility, operational complexity, long term).

## Related repositories

- `ahliweb/awcms` — backend and admin; ADR-0146 (persona apps), guard `tests/product-surface-policy.test.ts` (no Lynx there).
- `ahliweb/awcms-one` — commerce backend + Astro storefront; ADR-0050, ADR-0016, guard `tests/lynx-direction.test.mjs` (no Lynx there).

## Orchestrator & Agent (model AI)

> Standar lintas-portofolio dari [`ahliweb/personal-coding`](https://github.com/ahliweb/personal-coding/blob/main/docs/tingkatan-model-ai-claude-openai.md) (docs/tingkatan-model-ai-claude-openai.md, snapshot 2026-10-28). Harga, effort, dan lini model dipelihara di sana — jangan disalin ke repo ini.

Pekerjaan yang perlu dipecah ke beberapa agent memakai pola **orchestrator → agent**. Orchestrator memecah pekerjaan, membagi tugas, mengatur ketergantungan, lalu memeriksa dan menyatukan hasil; agent mengerjakan satu bagian yang sudah dibatasi.

| Peran | Claude Code | Codex / OpenAI |
| --- | --- | --- |
| Orchestrator | Opus 5.5, effort `high` | GPT-6.1 Sol, `high` |
| Agent kompleks — lintas komponen, keamanan, integrasi, risiko regresi | Sonnet 5.5, `medium` (subagent `pelaksana-kompleks`) | GPT-6.1 Sol atau Terra, `medium` |
| Agent sederhana — mekanis, terdefinisi jelas, risiko rendah | Haiku 5.5, `low` (subagent `pelaksana-sederhana`) | GPT-6 Luna atau Terra, `low` |

Pekerjaan kritis (arsitektur, keamanan, migrasi besar): orchestrator Fable 5.1 `high`–`xhigh`, agent kompleks Opus 5.5 `high`.

Aturan:

1. **Jangan memecah tugas kecil.** Coba satu model kuat (Opus 5.5 / GPT-6.1 Sol) dengan effort rendah lebih dulu.
2. **Naikkan, jangan menebak.** Agent sederhana yang menemukan ambiguitas, risiko, atau sentuhan arsitektur berhenti dan mengembalikan tugas ke orchestrator, yang memindahkannya ke agent kompleks.
3. **Agent paralel terisolasi.** Tidak boleh menyentuh file atau modul yang sama; tugas yang saling bergantung dijalankan berurutan.
4. **Verifikasi tetap di orchestrator.** Diff, uji, dan angka dicek sendiri sebelum dipakai; laporan agent bukan bukti.
5. **Agent tetap di scope-nya.** Tidak mengubah arsitektur, tidak mendelegasikan lagi, tidak menyentuh area di luar tugas.
6. **Aturan repo ini tetap berlaku** untuk setiap agent — alur kerja, gerbang, guardrail keamanan, konvensi commit.
