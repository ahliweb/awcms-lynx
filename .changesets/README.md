# Changesets

A changeset is a short Markdown file that records one change for the next release. The convention is adapted from the sister repository ahliweb/awcms-one.

Write a changeset when a change affects public behaviour, workspace structure, dependencies or deployment. Changes outside those areas do not need one.

## File name

`YYYY-MM-DD-kebab-summary.md`, for example `2026-10-25-lynx-template-foundation.md`. One file per change.

## Front matter

```
---
bump: major | minor | patch
type: feature | fix | docs | dependency | structure
impact: public | internal
---

# Title

Why it changed (the valuable half) and bullet points of what changed.
```

- `bump` is the semver level this change needs.
- `type` says what kind of change it is.
- `impact` says whether people outside the repository see the change (`public`) or not (`internal`).
- The `# Title` line becomes the changelog heading. The body explains why the change was made, then lists what changed.

## Releasing

- The next version is the largest `bump` among the pending changesets.
- Versions use plain semver arithmetic: `major` gives X+1.0.0, `minor` gives X.Y+1.0, `patch` gives X.Y.Z+1.
- `bun run release` previews the release and writes nothing.
- `bun run release --apply` writes the release. It adds a `## [X.Y.Z] — YYYY-MM-DD` section to `CHANGELOG.md`, below the intro and above older sections. It sets `version` in the root `package.json` and in every `apps/*` and `packages/*` `package.json`, because all workspaces share one version. It then deletes the folded changeset files. This file is never folded.
- `bun run release --apply --tag` does the same and runs `git tag vX.Y.Z`. It never pushes.
- `--bump=<level>` can raise the computed level, for example to start a release with a `major`. It cannot lower it; a lower value exits with code 1.

Changes are not pushed or committed by the release tool. Review the diff before committing.
