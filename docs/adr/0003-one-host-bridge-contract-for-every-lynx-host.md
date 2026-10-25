# ADR-0003 — One host-bridge contract for every Lynx host

- **Status:** Accepted
- **Date:** 25 October 2026
- **Decision maker:** ahliweb
- **Related:** ADR-0001, ADR-0004; `packages/platform/src/contract.ts`

## Context

The same ReactLynx bundle runs in five hosts, and a few capabilities can only come from the host: secure storage for a session token, the app version, opening a link in the system browser. Lynx exposes host capabilities as NativeModules, but each host wires them differently: native iOS/Android/HarmonyOS register custom modules; `<lynx-view>` on the Web forwards `NativeModules.bridge.call` to `onNativeModulesCall`; Lynxtron forwards it to the main process as `-lynx-invoke`. The Lynx background thread also lacks `URL`, `crypto` and `localStorage`, so the app cannot polyfill storage by itself.

## Decision

**D1.** A single versioned contract (`HOST_BRIDGE_VERSION = 1`) with five methods — `secureStorage.get|set|delete`, `app.info`, `link.open` — and one wire shape, `call(method, params, callback(reply))`, where `reply` is `{ok:true,result}` or `{ok:false,error:{code,message}}`, as an object or its JSON string.

**D2.** Lookup order in the app: custom native module `AwcmsHostBridge` → built-in `NativeModules.bridge` (Web, Lynxtron) → in-memory fallback (Lynx Explorer, unit tests). The fallback reports `secureStorage: 'memory'`, and the settings screen says so.

**D3.** Every host validates input itself (key namespace `awcms-lynx:*`, value ≤ 16 KiB, `link.open` http/https only). The app validates first too, so a bad call never reaches the host; the host check is defence in depth for a compromised bundle.

**D4.** `app.info.secureStorage` names the real backend (`keychain`, `android-keystore`, `harmony-huks`, `os-keyring`, `app-file`, `browser-storage`, `memory`). An honest label is part of the contract.

**D5.** Adding a method bumps `HOST_BRIDGE_VERSION`, adds it to `HOST_METHODS`, updates `hosts/contract-test-vectors.json` and every host in the same change.

## Options considered

| Criterion | One small contract (chosen) | Per-host code paths in the app | Third-party bridge library |
| --- | --- | --- | --- |
| Security | One validation rule set, reviewed once | Easy to miss a host | Extra supply-chain surface |
| Performance | One async hop per call | Same | Same or worse |
| Maintainability | Hosts reviewed in isolation against vectors | Branches everywhere | Coupled to its release cycle |
| Compatibility | Works on all five hosts and Explorer | Same | Rarely covers HarmonyOS and Lynxtron |
| Long term | Versioned; additive | Hard to evolve | Depends on maintainer |

## Consequences

- Native hosts in `hosts/` are reference sources until a derived product's PoC compiles them (`docs/status.md`).
- Push-token retrieval, camera, location and deep-link routing are **not** in v1; each needs a contract bump when a product's PoC needs it.
