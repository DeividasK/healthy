import { expect, test } from '@playwright/test';

import {
  appChanges,
  bumpVersion,
  extractSection,
  insertSection,
  isFragmentPath,
  parseFragment,
  renderSection,
} from './changelog';

const header = '# Changelog\n\nIntro.\n';

test('parses a fragment as one entry or one entry per list item', () => {
  expect(
    parseFragment(
      '.changes/a.md',
      '---\ntype: fixed\n---\n\nJournal days\nload faster.\n'
    )
  ).toEqual({
    file: '.changes/a.md',
    type: 'fixed',
    entries: ['Journal days load faster.'],
  });
  expect(
    parseFragment(
      '.changes/b.md',
      '---\ntype: added\n---\n\n- Bundles.\n- Exact\n  dose times.\n'
    ).entries
  ).toEqual(['Bundles.', 'Exact dose times.']);
});

test('rejects fragments without a known type or a description', () => {
  expect(() => parseFragment('.changes/a.md', 'No front matter')).toThrow(
    /front matter/
  );
  expect(() =>
    parseFragment('.changes/a.md', '---\ntype: new\n---\nText')
  ).toThrow(/type/);
  expect(() =>
    parseFragment('.changes/a.md', '---\ntype: added\n---\n')
  ).toThrow(/describe/);
});

test('bumps semantic versions', () => {
  expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
  expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
  expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  expect(() => bumpVersion('1.2', 'patch')).toThrow();
});

test('renders, inserts newest first and extracts release sections', () => {
  const section = renderSection('1.1.0', '2026-10-20', [
    { file: 'b', type: 'fixed', entries: ['Fix.'] },
    { file: 'a', type: 'added', entries: ['One.', 'Two.'] },
  ]);
  expect(section).toBe(
    '## [1.1.0] - 2026-10-20\n\n### Added\n\n- One.\n- Two.\n\n### Fixed\n\n- Fix.'
  );

  const first = insertSection(header, '1.1.0', section);
  const second = insertSection(
    first,
    '1.2.0',
    '## [1.2.0] - 2026-11-01\n\n### Changed\n\n- New.'
  );
  expect(second.indexOf('[1.2.0]')).toBeLessThan(second.indexOf('[1.1.0]'));
  expect(second.startsWith(header)).toBe(true);
  expect(() => insertSection(second, '1.1.0', section)).toThrow(/already/);

  expect(extractSection(second, '1.1.0')).toBe(
    '### Added\n\n- One.\n- Two.\n\n### Fixed\n\n- Fix.'
  );
  expect(extractSection(second, '1.2.0')).toBe('### Changed\n\n- New.');
  expect(extractSection(second, '1.0.0')).toBeUndefined();
});

test('only app changes outside tests need a fragment', () => {
  expect(
    appChanges([
      'src/features/home/HomeView.tsx',
      'src/features/home/home.e2e.ts',
      'src/features/testing/fixtures.ts',
      'app.json',
      'docs/releasing.md',
      '.github/workflows/ci.yml',
      'package.json',
    ])
  ).toEqual(['src/features/home/HomeView.tsx', 'app.json']);
  expect(isFragmentPath('.changes/96-x.md')).toBe(true);
  expect(isFragmentPath('.changes/README.md')).toBe(false);
});
