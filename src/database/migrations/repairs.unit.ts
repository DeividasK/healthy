import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { REPAIRS_REVISION } from './repairsRevision';
import type { DatabaseMigration } from './types';

/**
 * Each migration's repair as of `revision`. Devices skip repairs that already
 * ran for the latest schema version and revision. A new migration raises
 * that version by itself, so its repair only needs recording here; changing
 * a recorded repair also needs a new REPAIRS_REVISION to reach devices.
 */
const RECORDED = {
  revision: 1,
  repairs: {
    11: '19000198dd5b83fb',
    12: '3fd391633afc2328',
    13: 'ceb09c670cdabd12',
    14: '5d581cecf4162a50',
    15: '05049381567ac9a5',
    16: '8a49e175c36525c9',
    18: 'd3c6c8604b2e2efc',
    19: '615f0e1d464e5e0c',
    20: '33688db5ce5a3f03',
  } as Record<number, string>,
};

async function repairFingerprints(): Promise<Record<number, string>> {
  const fingerprints: Record<number, string> = {};
  for (const file of readdirSync(__dirname).filter((name) =>
    /^v\d+\.ts$/.test(name)
  )) {
    const exports = (await import(`./${file}`)) as Record<string, unknown>;
    for (const value of Object.values(exports)) {
      const migration = value as DatabaseMigration;
      if (migration?.repair)
        fingerprints[migration.version] = createHash('sha256')
          .update(migration.repair.toString())
          .digest('hex')
          .slice(0, 16);
    }
  }
  return fingerprints;
}

test('changed repairs come with a new REPAIRS_REVISION', async () => {
  const current = await repairFingerprints();
  const changed = Object.keys(RECORDED.repairs)
    .map(Number)
    .filter((version) => current[version] !== RECORDED.repairs[version]);
  if (changed.length > 0)
    expect(
      REPAIRS_REVISION,
      `Repairs of v${changed.join(', v')} changed: bump REPAIRS_REVISION, then record it and the fingerprints below.`
    ).toBeGreaterThan(RECORDED.revision);
  expect(
    { revision: REPAIRS_REVISION, repairs: current },
    'Record the current revision and repair fingerprints in RECORDED.'
  ).toEqual(RECORDED);
});
