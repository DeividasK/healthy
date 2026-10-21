import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { REPAIRS_REVISION } from './repairsRevision';
import type { DatabaseMigration } from './types';

/**
 * The repairs each revision ran. Devices skip repairs they already ran for a
 * revision, so changed repair code needs a new revision to reach them.
 */
const RECORDED = { revision: 1, fingerprint: '868e61f79e69956d' };

test('changed repairs come with a new REPAIRS_REVISION', async () => {
  const files = readdirSync(__dirname)
    .filter((name) => /^v\d+\.ts$/.test(name))
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  const hash = createHash('sha256');
  for (const file of files) {
    const exports = (await import(`./${file}`)) as Record<string, unknown>;
    for (const value of Object.values(exports)) {
      const migration = value as DatabaseMigration;
      if (migration?.repair)
        hash.update(`${migration.version}:${migration.repair.toString()}\n`);
    }
  }
  const fingerprint = hash.digest('hex').slice(0, 16);
  expect(
    { revision: REPAIRS_REVISION, fingerprint },
    'A repair changed: bump REPAIRS_REVISION, then record it and this fingerprint here.'
  ).toEqual(RECORDED);
});
