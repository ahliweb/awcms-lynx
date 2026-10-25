import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUMPS,
  type Changeset,
  IMPACTS,
  insertChangelogSection,
  largestBump,
  nextVersion,
  parseChangeset,
  readPackageVersion,
  renderChangelogSection,
  TYPES,
  workspacePackageFiles,
} from '../tools/release.ts';

const ROOT = join(import.meta.dir, '..');
const CHANGESETS = join(ROOT, '.changesets');

const VALID = `---
bump: minor
type: fix
impact: public
---

# Fix the thing

Why it changed.

- What changed.
`;

function changeset(title: string): Changeset {
  return parseChangeset(VALID.replace('# Fix the thing', `# ${title}`), 'test.md');
}

describe('pending changesets', () => {
  const files = readdirSync(CHANGESETS).filter(
    (file) => file.endsWith('.md') && file !== 'README.md',
  );

  test('every changeset file is named YYYY-MM-DD-kebab-summary.md', () => {
    for (const file of files) {
      expect(file).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.md$/);
    }
  });

  test('every changeset parses with a valid bump, type and impact', () => {
    for (const file of files) {
      const parsed = parseChangeset(readFileSync(join(CHANGESETS, file), 'utf8'), file);
      expect(BUMPS).toContain(parsed.bump);
      expect(TYPES).toContain(parsed.type);
      expect(IMPACTS).toContain(parsed.impact);
      expect(parsed.title).not.toBe('');
    }
  });
});

describe('nextVersion', () => {
  test('applies plain semver arithmetic', () => {
    expect(nextVersion('0.1.0', 'patch')).toBe('0.1.1');
    expect(nextVersion('0.1.0', 'minor')).toBe('0.2.0');
    expect(nextVersion('0.1.0', 'major')).toBe('1.0.0');
    expect(nextVersion('1.9.9', 'minor')).toBe('1.10.0');
  });

  test('throws on an invalid version', () => {
    expect(() => nextVersion('1.0', 'patch')).toThrow(/Invalid version/);
    expect(() => nextVersion('v1.0.0', 'minor')).toThrow(/Invalid version/);
  });
});

describe('largestBump', () => {
  test('returns the highest bump', () => {
    expect(largestBump(['patch', 'minor'])).toBe('minor');
    expect(largestBump(['patch', 'major', 'minor'])).toBe('major');
  });

  test('returns null for no changesets', () => {
    expect(largestBump([])).toBeNull();
  });
});

describe('parseChangeset', () => {
  test('parses front matter, title and body', () => {
    expect(parseChangeset(VALID, 'a.md')).toEqual({
      bump: 'minor',
      type: 'fix',
      impact: 'public',
      title: 'Fix the thing',
      body: 'Why it changed.\n\n- What changed.',
    });
  });

  test('rejects missing front matter', () => {
    expect(() => parseChangeset('# Fix the thing\n\nBody.\n', 'x.md')).toThrow(
      /x\.md.*front matter/,
    );
  });

  test('rejects an invalid bump', () => {
    expect(() => parseChangeset(VALID.replace('bump: minor', 'bump: huge'), 'x.md')).toThrow(
      /x\.md.*"bump"/,
    );
  });

  test('rejects a missing title', () => {
    expect(() => parseChangeset(VALID.replace('# Fix the thing\n\n', ''), 'x.md')).toThrow(
      /x\.md.*# Title/,
    );
  });
});

describe('renderChangelogSection', () => {
  test('renders the version heading and one ### per changeset', () => {
    const section = renderChangelogSection('0.2.0', '2026-10-25', [
      changeset('First change'),
      changeset('Second change'),
    ]);
    expect(section).toContain('## [0.2.0] — 2026-10-25');
    expect(section).toContain('### First change');
    expect(section).toContain('### Second change');
    expect(section).toContain('Why it changed.');
  });
});

describe('insertChangelogSection', () => {
  test('places the section after the intro and before older releases', () => {
    const existing =
      '# Changelog\n\nIntro paragraph.\n\n## [0.1.0] — 2026-10-01\n\n### Old\n\nold\n';
    const out = insertChangelogSection(existing, '## [0.2.0] — 2026-10-25\n\n### New\n\nnew\n');
    expect(out.indexOf('Intro paragraph.')).toBeLessThan(out.indexOf('## [0.2.0]'));
    expect(out.indexOf('## [0.2.0]')).toBeLessThan(out.indexOf('## [0.1.0]'));
    expect(out.endsWith('### Old\n\nold\n')).toBe(true);
  });

  test('appends the section when there is no earlier release', () => {
    const out = insertChangelogSection('# Changelog\n\nIntro.\n', '## [0.2.0] — 2026-10-25\n');
    expect(out).toBe('# Changelog\n\nIntro.\n\n## [0.2.0] — 2026-10-25\n');
  });
});

describe('workspace versions', () => {
  test('root, apps/* and packages/* package.json versions are identical', () => {
    const files = workspacePackageFiles(ROOT);
    expect(files.length).toBeGreaterThan(1);
    const versions = new Set(files.map((file) => readPackageVersion(file)));
    expect([...versions]).toHaveLength(1);
  });
});
