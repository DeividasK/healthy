import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
} from '@/src/features/testing/testStorage';
import { mockGoogleDrive } from '@/src/features/testing/mockGoogleDrive';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  test(`${transport} preserves full Condition terminology and timestamps`, async ({
    page,
  }) => {
    await seedTestPatient(page, {
      id: 'terminology-backup',
      syncAccount: 'synthetic-google-sub',
    });
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
    const config = {
      accessToken: 'synthetic-token',
      userSub: 'synthetic-google-sub',
    };
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
      const files = await mockGoogleDrive(page);
      const summary = await page.evaluate(
        (configuration) =>
          (window as any).__HEALTHY_TEST_BRIDGE__.backupToGoogleDrive(
            configuration
          ),
        config
      );
      expect(summary.conditions).toBe(1);
      expect(
        Array.from(files.values())
          .find((file) => file.name.startsWith('condition_'))!
          .bytes.toString()
      ).not.toContain('Original wording');
    }
    const restored = await page.evaluate(
      async ({ transport, config, archive }) => {
        const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
        await bridge.clearDatabase();
        if (transport === 'ZIP') await bridge.restoreArchive(archive);
        else await bridge.restoreFromGoogleDrive(config);
        return await bridge.getCondition('coded-backup');
      },
      { transport, config, archive }
    );
    expect(restored).toEqual(original);
    if (transport === 'encrypted Drive') {
      const retained = await page.evaluate(async (configuration) => {
        const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
        const condition = await bridge.getCondition('coded-backup');
        condition.code.coding[0].code = 'NEWER';
        condition.meta.lastUpdated = '2099-01-01T00:00:00Z';
        await bridge.saveCondition(condition, 'terminology-backup');
        await bridge.restoreFromGoogleDrive(configuration);
        return await bridge.getCondition('coded-backup');
      }, config);
      expect(retained.code.coding[0].code).toBe('NEWER');
      expect(retained.code.coding[1]).toEqual(original.code.coding[1]);
      expect(retained.meta.lastUpdated).toBe('2099-01-01T00:00:00Z');
    }
  });
}
