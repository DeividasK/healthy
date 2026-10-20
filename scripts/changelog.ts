// Changelog fragments (`.changes/*.md`) and releases. See docs/releasing.md.
//
//   node scripts/changelog.ts check            a branch with app changes adds a fragment
//   node scripts/changelog.ts prepare <bump>   compile fragments into CHANGELOG.md, bump the version
//   node scripts/changelog.ts notes [version]  print a version's CHANGELOG.md section
//   node scripts/changelog.ts verify           the current version is released and documented
//
// Runs with Node's built-in type stripping, so it only uses Node built-ins.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const CHANGE_TYPES = [
  'added',
  'changed',
  'fixed',
  'removed',
  'security',
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];
export type Bump = 'major' | 'minor' | 'patch';

export type Fragment = { file: string; type: ChangeType; entries: string[] };

export const CHANGES_DIR = '.changes';
export const CHANGELOG_FILE = 'CHANGELOG.md';
export const NO_CHANGELOG_TRAILER = /^Changelog:\s*none\s*$/im;

const HEADINGS: Record<ChangeType, string> = {
  added: 'Added',
  changed: 'Changed',
  fixed: 'Fixed',
  removed: 'Removed',
  security: 'Security',
};

// Files that change what users get. Tests and test-only helpers don't.
const APP_PATHS = [
  /^app\//,
  /^src\//,
  /^assets\//,
  /^public\//,
  /^plugins\//,
  /^patches\//,
  /^app\.json$/,
  /^app\.config\.js$/,
  /^global\.css$/,
  /^tailwind\.config\.js$/,
];
const TEST_PATHS = [/\.(e2e|visual|unit)\.tsx?$/, /^src\/features\/testing\//];

export function isFragmentPath(file: string): boolean {
  return /^\.changes\/[^/]+\.md$/.test(file) && file !== '.changes/README.md';
}

export function appChanges(files: string[]): string[] {
  return files.filter(
    (file) =>
      APP_PATHS.some((pattern) => pattern.test(file)) &&
      !TEST_PATHS.some((pattern) => pattern.test(file))
  );
}

export function parseFragment(file: string, text: string): Fragment {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(
    text.trim() + '\n'
  );
  if (!match) throw new Error(`${file}: expected front matter with a type`);
  const type = /^type:\s*(\S+)\s*$/m.exec(match[1])?.[1];
  if (!CHANGE_TYPES.includes(type as ChangeType))
    throw new Error(`${file}: type must be one of ${CHANGE_TYPES.join(', ')}`);

  // A body of `- ` lines is one entry per line; any other body is one entry.
  const body = match[2].trim();
  const entries = body.startsWith('- ')
    ? body.split(/\n(?=- )/).map((entry) => entry.slice(2))
    : [body];
  const normalized = entries
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (normalized.length === 0) throw new Error(`${file}: describe the change`);
  return { file, type: type as ChangeType, entries: normalized };
}

export function bumpVersion(version: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Version ${version} is not major.minor.patch`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function renderSection(
  version: string,
  date: string,
  fragments: Fragment[]
): string {
  const groups = CHANGE_TYPES.map((type) => ({
    type,
    entries: fragments
      .filter((fragment) => fragment.type === type)
      .flatMap((f) => f.entries),
  })).filter((group) => group.entries.length > 0);
  return [
    `## [${version}] - ${date}`,
    ...groups.map(
      (group) =>
        `### ${HEADINGS[group.type]}\n\n${group.entries.map((entry) => `- ${entry}`).join('\n')}`
    ),
  ].join('\n\n');
}

function sectionStart(changelog: string, version: string): number {
  const heading = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm');
  return changelog.search(heading);
}

// Newest first: the section goes above the first existing release.
export function insertSection(
  changelog: string,
  version: string,
  section: string
): string {
  if (sectionStart(changelog, version) !== -1)
    throw new Error(`${CHANGELOG_FILE} already has a section for ${version}`);
  const first = changelog.search(/^## /m);
  if (first === -1) return `${changelog.trimEnd()}\n\n${section}\n`;
  return `${changelog.slice(0, first)}${section}\n\n${changelog.slice(first)}`;
}

export function extractSection(
  changelog: string,
  version: string
): string | undefined {
  const start = sectionStart(changelog, version);
  if (start === -1) return undefined;
  const afterHeading = changelog.indexOf('\n', start) + 1 || changelog.length;
  const next = changelog.slice(afterHeading).search(/^## /m);
  const end = next === -1 ? changelog.length : afterHeading + next;
  return changelog.slice(afterHeading, end).trim();
}

// Run from the repository root (pnpm scripts and EAS jobs do).
const root = process.cwd();

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function readJson(file: string): {
  version: string;
  expo?: { version: string };
} {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}

function writeJson(file: string, value: unknown) {
  writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

function appVersion(): string {
  const version = readJson('app.json').expo?.version;
  if (!version) throw new Error('app.json has no expo.version');
  return version;
}

function readFragments(): Fragment[] {
  const dir = path.join(root, CHANGES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => `${CHANGES_DIR}/${name}`)
    .filter(isFragmentPath)
    .sort()
    .map((file) =>
      parseFragment(file, readFileSync(path.join(root, file), 'utf8'))
    );
}

function readChangelog(): string {
  return readFileSync(path.join(root, CHANGELOG_FILE), 'utf8');
}

function check(base = process.env.CHANGELOG_BASE ?? 'origin/main') {
  readFragments();
  if (process.env.GITHUB_REF_NAME === 'release') return;
  const mergeBase = git('merge-base', base, 'HEAD');
  const changed = git(
    'diff',
    '--name-status',
    '--no-renames',
    mergeBase,
    'HEAD'
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
  const app = appChanges(changed.map(([, file]) => file));
  if (app.length === 0) return;
  const documented = changed.some(
    ([status, file]) =>
      (isFragmentPath(file) && status !== 'D') || file === CHANGELOG_FILE
  );
  if (
    documented ||
    NO_CHANGELOG_TRAILER.test(git('log', '--format=%B', `${mergeBase}..HEAD`))
  )
    return;
  throw new Error(
    [
      `This branch changes the app (${app.slice(0, 5).join(', ')}${app.length > 5 ? ', ...' : ''}) without a changelog fragment.`,
      `Add one under ${CHANGES_DIR}/ (see ${CHANGES_DIR}/README.md), or add a "Changelog: none" trailer`,
      'to a commit message when users would not notice the change.',
    ].join('\n')
  );
}

function prepare(bump: string | undefined) {
  if (bump !== 'major' && bump !== 'minor' && bump !== 'patch')
    throw new Error('Usage: prepare <major|minor|patch>');
  const fragments = readFragments();
  if (fragments.length === 0)
    throw new Error(`No fragments in ${CHANGES_DIR}/ to release`);
  const version = bumpVersion(appVersion(), bump);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(
    path.join(root, CHANGELOG_FILE),
    insertSection(
      readChangelog(),
      version,
      renderSection(version, date, fragments)
    )
  );
  for (const file of ['app.json', 'package.json']) {
    const json = readJson(file);
    if (json.expo) json.expo.version = version;
    else json.version = version;
    writeJson(file, json);
  }
  fragments.forEach((fragment) => rmSync(path.join(root, fragment.file)));
  console.log(`Prepared ${version} from ${fragments.length} fragment(s).`);
}

function notes(version = appVersion()): string {
  const section = extractSection(readChangelog(), version);
  if (section === undefined)
    throw new Error(`${CHANGELOG_FILE} has no section for ${version}`);
  return section;
}

// A release ships the version in app.json, documented, with nothing left unreleased.
function verify() {
  const fragments = readFragments();
  if (fragments.length > 0)
    throw new Error(
      `Unreleased fragments: ${fragments.map((f) => f.file).join(', ')}. Run "pnpm release:prepare <bump>" on main first.`
    );
  notes();
}

if (process.argv[1]?.endsWith(path.join('scripts', 'changelog.ts'))) {
  const [command, arg] = process.argv.slice(2);
  try {
    if (command === 'check') check();
    else if (command === 'prepare') prepare(arg);
    else if (command === 'notes') console.log(notes(arg));
    else if (command === 'verify') verify();
    else throw new Error('Usage: changelog.ts <check|prepare|notes|verify>');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
