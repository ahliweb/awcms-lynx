# Development workflow

## Setup

```bash
bun install                       # Bun 1.4.4+, Node 22.18+ also required (ADR-0002)
cp .env.example apps/mobile/.env  # and apps/web/.env, apps/desktop/.env as needed
```

Point `PUBLIC_AWCMS_API_BASE_URL` at a backend you run locally: `ahliweb/awcms` (`bun run dev`, port 4321) or `ahliweb/awcms-one` (`bun run db:up && bun run --cwd apps/cms dev`, plus the storefront for the catalog index). On the Android emulator the host machine is `10.0.2.2`; on a physical phone use the machine's LAN IP (http is accepted only for loopback and private-LAN addresses).

## Daily loop

| Goal | Command |
| --- | --- |
| Phone (Explorer) with hot reload | `bun run dev`, scan the QR code |
| Browser | `bun run build:mobile && bun run dev:web` |
| Desktop | `bun run dev:desktop` |
| All gates before pushing | `bun run check` |
| Lint autofix | `bunx biome check --write .` |

Debug with [Lynx DevTool](https://github.com/lynx-family/lynx-devtool/releases) (USB to the device) or `npx agent-lynx` for scripted inspection.

## Where a change goes

| Change | Location | Also update |
| --- | --- | --- |
| New screen or component | `packages/app/src/` | strings in both locales, a UI test, `docs/ui-guidelines.md` if a pattern is new |
| New backend call | `packages/client/src/awcms.ts` or `commerce.ts` | client tests, `docs/backend-integration.md` |
| New host capability | `packages/platform/src/contract.ts` + every host | `HOST_BRIDGE_VERSION`, `hosts/contract-test-vectors.json`, ADR-0003 consequences |
| New config key | `packages/platform/src/runtime-config.ts` | `.env.example`, `apps/mobile/src/build-env.ts`, `env.d.ts`, web/desktop hosts |
| Decision with trade-offs | `docs/adr/NNNN-*.md` | `docs/adr/README.md` index |

## Pull requests

- One atomic, independently verifiable change per PR; branch from `main`.
- `bun run check` green locally and in CI.
- A changeset under `.changesets/` when public behaviour, structure, dependencies or deployment change ([`.changesets/README.md`](../.changesets/README.md)).
- Documentation updated in the same PR; Indonesian mirrors (`*.id.md`) updated with their English source.
- Commit messages: conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`) and the *why* in the body.

## Releases

`bun run release` previews the next version from pending changesets; `bun run release --apply --tag` folds them into `CHANGELOG.md`, bumps every workspace's version, and tags `vX.Y.Z`. Push the commit and the tag.
