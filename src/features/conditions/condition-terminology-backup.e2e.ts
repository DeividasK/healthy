import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  connectTestSync,
  syncTestDevice,
  driveContents,
} from '@/src/features/testing/testStorage';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  test(`${transport} preserves full Condition terminology and timestamps`, async ({
    page,
  }) => {
    await seedTestPatient(page, { id: 'terminology-backup' });
    const seeded = await seedTestCondition(page, {
      id: 'coded-backup',
      title: 'Original wording',
      terminology: { code: 'L21' },
    });
    const original = {
      ...seeded,
      code: {
        ...seeded.code,
        coding: [
          {
            code: 'L21',
            version: 'synthetic-edition',
            extension: [
              {
                url: 'https://example.org/retained',
                valueString: 'nested field',
              },
            ],
          },
          { system: 'https://example.org/second', code: 'SECOND' },
        ],
      },
    };
    await page.evaluate(
      (resource) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.saveCondition(
          resource,
          'terminology-backup'
        ),
      original
    );
    let archive: number[] = [];
    if (transport === 'ZIP') {
      const downloadPromise = page.waitForEvent('download');
      await page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive()
      );
      archive = Array.from(
        await readFile((await (await downloadPromise).path())!)
      );
    } else {
      const { store } = await connectTestSync(page);
      await syncTestDevice(page);
      expect(driveContents(store)).not.toContain('Original wording');
    }
    const restored = await page.evaluate(
      async ({ transport, archive }) => {
        const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
        await bridge.clearDatabase();
        if (transport === 'ZIP') await bridge.restoreArchive(archive);
        else await bridge.syncAllProfiles();
        return await bridge.getCondition('coded-backup');
      },
      { transport, archive }
    );
    expect(restored).toEqual(original);
    if (transport === 'encrypted Drive') {
      const retained = await page.evaluate(async () => {
        const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
        const condition = await bridge.getCondition('coded-backup');
        condition.code.coding[0].code = 'NEWER';
        condition.meta.lastUpdated = '2099-01-01T00:00:00Z';
        await bridge.saveCondition(condition, 'terminology-backup');
        await bridge.syncNow();
        await bridge.clearDatabase();
        await bridge.syncAllProfiles();
        return await bridge.getCondition('coded-backup');
      });
      expect(retained.code.coding[0].code).toBe('NEWER');
      expect(retained.code.coding[1]).toEqual(original.code.coding[1]);
      expect(retained.meta.lastUpdated).toBe('2099-01-01T00:00:00Z');
    }
  });
}
