import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const BUMPS = ['major', 'minor', 'patch'] as const;
export const TYPES = ['feature', 'fix', 'docs', 'dependency', 'structure'] as const;
export const IMPACTS = ['public', 'internal'] as const;

export type Bump = (typeof BUMPS)[number];
export type ChangesetType = (typeof TYPES)[number];
export type Impact = (typeof IMPACTS)[number];

export interface Changeset {
  bump: Bump;
  type: ChangesetType;
  impact: Impact;
  title: string;
  body: string;
}

interface Options {
  apply: boolean;
  tag: boolean;
  bump: Bump | null;
}

interface PendingChangeset {
  file: string;
  changeset: Changeset;
}

const ROOT = resolve(import.meta.dir, '..');
const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const WORKSPACE_GROUPS = ['apps', 'packages'] as const;
const CHANGELOG_HEADER = '# Changelog\n\n';
const VERSION_LINE = /^ {2}"version": "[^"]*"/m;

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function readEnum<T extends string>(
  fields: ReadonlyMap<string, string>,
  key: string,
  allowed: readonly T[],
  file: string,
): T {
  const value = fields.get(key);
  if (value === undefined) {
    throw new Error(`${file}: missing front matter field "${key}"`);
  }
  if (!isOneOf(allowed, value)) {
    throw new Error(`${file}: "${key}" must be one of ${allowed.join(', ')}; got "${value}"`);
  }
  return value;
}

/** Parses one changeset file: a front matter block, then a `# Title` and the body. */
export function parseChangeset(text: string, file: string): Changeset {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (lines[0]?.trim() !== '---' || closing === -1) {
    throw new Error(`${file}: missing front matter; expect a "---" block with bump, type, impact`);
  }

  const fields = new Map<string, string>();
  for (const line of lines.slice(1, closing)) {
    if (line.trim() === '') continue;
    const field = /^([a-z]+):\s*(.*?)\s*$/.exec(line);
    if (!field) throw new Error(`${file}: invalid front matter line "${line}"`);
    fields.set(field[1] ?? '', field[2] ?? '');
  }
  const bump = readEnum(fields, 'bump', BUMPS, file);
  const type = readEnum(fields, 'type', TYPES, file);
  const impact = readEnum(fields, 'impact', IMPACTS, file);

  const rest = lines.slice(closing + 1);
  const titleAt = rest.findIndex((line) => line.trim() !== '');
  const heading = /^#\s+(.+?)\s*$/.exec(rest[titleAt] ?? '');
  if (!heading) throw new Error(`${file}: the body must start with a "# Title" heading`);

  return {
    bump,
    type,
    impact,
    title: heading[1] ?? '',
    body: rest
      .slice(titleAt + 1)
      .join('\n')
      .trim(),
  };
}

/** Plain semver arithmetic: major X+1.0.0, minor X.Y+1.0, patch X.Y.Z+1. */
export function nextVersion(current: string, bump: Bump): string {
  const parts = SEMVER.exec(current)?.slice(1).map(Number);
  if (parts?.length !== 3) {
    throw new Error(`Invalid version "${current}"; expected MAJOR.MINOR.PATCH`);
  }
  const [major = 0, minor = 0, patch = 0] = parts;
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The highest bump in the list, or null when the list is empty. */
export function largestBump(bumps: readonly string[]): Bump | null {
  let best: Bump | null = null;
  for (const value of bumps) {
    if (!isOneOf(BUMPS, value)) throw new Error(`Unknown bump "${value}"`);
    if (best === null || RANK[value] > RANK[best]) best = value;
  }
  return best;
}

/** One changelog section: a `## [X.Y.Z] — date` heading, then `###` per changeset. */
export function renderChangelogSection(
  version: string,
  date: string,
  changesets: readonly Changeset[],
): string {
  const lines = [`## [${version}] — ${date}`, ''];
  for (const changeset of changesets) {
    lines.push(`### ${changeset.title}`, '');
    if (changeset.body !== '') lines.push(changeset.body, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** Places a section after the intro and before the first `## [` heading (or at the end). */
export function insertChangelogSection(existing: string, section: string): string {
  const heading = /^## \[/m.exec(existing);
  const intro = (heading ? existing.slice(0, heading.index) : existing).trim();
  const history = heading ? existing.slice(heading.index).trim() : '';
  return `${[intro, section.trim(), history].filter((part) => part !== '').join('\n\n')}\n`;
}

/** Root package.json plus every apps/* and packages/* package.json that exists. */
export function workspacePackageFiles(root: string): string[] {
  const files = [join(root, 'package.json')];
  for (const group of WORKSPACE_GROUPS) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const file = join(dir, entry.name, 'package.json');
      if (entry.isDirectory() && existsSync(file)) files.push(file);
    }
  }
  return files;
}

export function readPackageVersion(file: string): string {
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
  if (typeof pkg.version !== 'string') {
    throw new Error(`${file}: no string "version" field`);
  }
  return pkg.version;
}

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { apply: false, tag: false, bump: null };
  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--tag') {
      options.tag = true;
    } else if (arg.startsWith('--bump=')) {
      const value = arg.slice('--bump='.length);
      if (!isOneOf(BUMPS, value)) {
        throw new Error(`--bump must be major, minor or patch; got "${value}"`);
      }
      options.bump = value;
    } else {
      throw new Error(
        `Unknown argument "${arg}". Usage: bun run release [--apply [--tag]] [--bump=LEVEL]`,
      );
    }
  }
  if (options.tag && !options.apply) throw new Error('--tag requires --apply');
  return options;
}

/** --bump may only raise the computed level, never lower it. */
export function resolveBump(computed: Bump, requested: Bump | null): Bump {
  if (requested === null) return computed;
  if (RANK[requested] < RANK[computed]) {
    throw new Error(
      `--bump=${requested} would lower the computed ${computed} bump; --bump can only raise it`,
    );
  }
  return requested;
}

function readPendingChangesets(dir: string): PendingChangeset[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .sort()
    .map((file) => ({
      file,
      changeset: parseChangeset(readFileSync(join(dir, file), 'utf8'), file),
    }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ReleasePlan {
  root: string;
  next: string;
  section: string;
  pending: PendingChangeset[];
  tag: boolean;
}

function applyRelease(plan: ReleasePlan): void {
  const { root, next, section, pending, tag } = plan;
  const packageFiles = workspacePackageFiles(root);
  const versions = new Set(packageFiles.map((file) => readPackageVersion(file)));
  if (versions.size !== 1) {
    throw new Error(`Workspace versions differ (${[...versions].join(', ')}); align them first`);
  }

  const changelogPath = join(root, 'CHANGELOG.md');
  const existing = existsSync(changelogPath)
    ? readFileSync(changelogPath, 'utf8')
    : CHANGELOG_HEADER;
  if (existing.includes(`## [${next}]`)) {
    throw new Error(`CHANGELOG.md already has a section for ${next}`);
  }

  // Validate every package.json before writing any of them.
  const updates = packageFiles.map((file) => {
    const text = readFileSync(file, 'utf8');
    if (!VERSION_LINE.test(text)) throw new Error(`${file}: top-level "version" line not found`);
    return { file, text: text.replace(VERSION_LINE, `  "version": "${next}"`) };
  });
  for (const update of updates) writeFileSync(update.file, update.text);

  writeFileSync(changelogPath, insertChangelogSection(existing, section));
  for (const { file } of pending) unlinkSync(join(root, '.changesets', file));
  console.log(
    `Released ${next}: bumped ${updates.length} package.json file(s), updated CHANGELOG.md, ` +
      `removed ${pending.length} changeset(s).`,
  );

  if (tag) {
    const result = Bun.spawnSync(['git', 'tag', `v${next}`], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.exitCode !== 0) {
      const reason = new TextDecoder().decode(result.stderr).trim();
      throw new Error(`git tag v${next} failed (files were already updated): ${reason}`);
    }
    console.log(`Tagged v${next} (not pushed).`);
  }
}

export function main(argv: readonly string[], root: string = ROOT): number {
  const options = parseArgs(argv);
  const pending = readPendingChangesets(join(root, '.changesets'));
  const computed = largestBump(pending.map(({ changeset }) => changeset.bump));
  if (computed === null) {
    console.log('No pending changesets.');
    return 0;
  }

  const level = resolveBump(computed, options.bump);
  const current = readPackageVersion(join(root, 'package.json'));
  const next = nextVersion(current, level);
  const section = renderChangelogSection(
    next,
    today(),
    pending.map(({ changeset }) => changeset),
  );

  console.log(`Release ${current} -> ${next} (${level}) from ${pending.length} changeset(s):`);
  for (const { file } of pending) console.log(`  - ${file}`);
  console.log(`\n${section}`);

  if (!options.apply) {
    console.log('Preview only. Run "bun run release --apply" to write the release.');
    return 0;
  }
  applyRelease({ root, next, section, pending, tag: options.tag });
  return 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
