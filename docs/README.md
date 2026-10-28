# Documentation

| Page | Read it when |
| --- | --- |
| [`architecture.md`](architecture.md) | you need the big picture: layers, threads, boot, routing, persisted data, who owns which concern |
| [`backend-integration.md`](backend-integration.md) | you call or change an API: every endpoint, header and error per backend, CORS, the backend gaps |
| [`lynx-runtime.md`](lynx-runtime.md) | you write code that runs in Lynx: what the runtime has and lacks, with sources |
| [`security.md`](security.md) | you touch sessions, hosts, configuration or personal data; standards mapping |
| [`ui-guidelines.md`](ui-guidelines.md) | you build a screen: elements, components, tokens and contrast, accessibility, responsive layout, language |
| [`testing.md`](testing.md) | you add or run tests |
| [`deployment.md`](deployment.md) | you ship a target: iOS, Android, HarmonyOS, Web, macOS, Windows |
| [`development.md`](development.md) | you set up, run the daily loop, open a PR or cut a release |
| [`status.md`](status.md) | you need to know what is verified, per target, and what is not |
| [`adr/`](adr/README.md) | you want to know why something is the way it is |
| [`../hosts/README.md`](../hosts/README.md) | you build a native host |

## Coverage of the documentation checklist

A client template has no server-side concerns of its own; those rows point to where the concern lives.

| Topic | Where |
| --- | --- |
| Architecture | `architecture.md`, ADR-0001…0004 |
| Database schema / data dictionary | `architecture.md` §Data the client keeps (two secure-storage records); server schema lives in the backend repositories |
| API documentation | `backend-integration.md`, `../packages/client/README.md` |
| CMS / content management, publishing workflow, content taxonomy | `architecture.md` §Where each concern lives — content is managed and published in the backend's Astro admin; the app reads published content only (feed, site search with `type` filter, storefront news `rubrik`/`region`) |
| Permissions and authorization | `security.md`, `architecture.md` — decided by the backend (RBAC + ABAC, RLS); the app shows roles |
| Audit logging | `architecture.md` — server-side; the client sends `X-Correlation-ID` on every call |
| Media management, logo management | `architecture.md`, `ui-guidelines.md` §Design tokens — images rendered from API URLs; branding via tokens, app name and host icons |
| Routing | `architecture.md` §Routing |
| Advertising | `architecture.md` — none in the template |
| SEO | `architecture.md`, `deployment.md` §Web — not applicable to a persona app; the web host is `noindex`; public SEO stays Astro |
| Accessibility, responsive design, UI/UX | `ui-guidelines.md` |
| Testing | `testing.md` |
| Deployment | `deployment.md`, `../hosts/README.md`, `../apps/web/README.md`, `../apps/desktop/README.md` |
| Development workflows, repository guidelines | `development.md`, `../CONTRIBUTING.md`, `../.changesets/README.md` |
| Agent instructions, skills | `../AGENTS.md` (incl. orchestrator & agent roles), `../.claude/agents/`, `../.claude/skills/` |
