---
name: awcms-lynx-feature
description: Add or change a feature in the awcms-lynx LynxJS/ReactLynx template end to end — backend call in packages/client, screen in packages/app, host capability in packages/platform + hosts, tests, docs, changeset. Use for any "add a screen", "call endpoint X", "support capability Y on the device" request in this repository.
---

# Adding a feature to awcms-lynx

Read `AGENTS.md` first; this skill is the step order, not a replacement for its rules. Read <https://lynxjs.org/llms.txt> before writing Lynx UI code.

## 1. Classify

| The feature needs… | Touch |
| --- | --- |
| a backend endpoint | `packages/client` (step 2) |
| a screen or UI change | `packages/app` (step 3) |
| something only the device can do (storage, camera, push token, deep link) | `packages/platform/src/contract.ts` + every host (step 4) |
| a new endpoint the backend does not have | stop — raise it in `ahliweb/awcms` or `ahliweb/awcms-one` (ADR-0146 §6.5) and add a row to `docs/backend-integration.md` §Gaps |

## 2. Backend call (`packages/client`)

1. Read the backend route source and its OpenAPI fragment; note path, auth, tenant rule, body, response, error codes.
2. Add the DTO to `src/types.ts`, the method to `src/awcms.ts` or `src/commerce.ts` (`authed()` for bearer routes; never send `X-AWCMS-Tenant-ID` to commerce routes).
3. No `URL`, `crypto`, `Intl`; generic helpers as `function name<T>()`.
4. Tests in `src/__tests__/` with the fake fetch: exact path, headers, body, success, each documented error.
5. Row in `docs/backend-integration.md` citing the backend file.

## 3. Screen (`packages/app`)

1. Use `Screen`/`Section`/`Row`/`Button`/`TextField`/`Notice`; lowercase Lynx elements only.
2. Data through `useApp().client`; loading/error/empty states via `useAsync` + `describeError`.
3. Strings in both tables of `src/i18n.ts`.
4. Accessibility checklist in `docs/ui-guidelines.md`.
5. UI test in `apps/mobile/src/__tests__/` with the real client over a fake fetch.

## 4. Host capability

1. Add the method to `HostMethodMap`, `HOST_METHODS`, `checkHostParams`; bump `HOST_BRIDGE_VERSION`.
2. Implement in `packages/platform/src/web-host.ts`, `apps/desktop` main process, and `hosts/{android,ios,harmony}` (mark unverifiable native calls `VERIFY:`).
3. Add cases to `hosts/contract-test-vectors.json` and bump its `contractVersion`.
4. Update ADR-0003 consequences and `hosts/README.md`.

## 5. Close

- `bun run check` green.
- English docs + `.id.md` mirrors updated.
- Changeset in `.changesets/` (`bump` chosen now).
- `docs/status.md` says honestly what was and was not verified on which target.
