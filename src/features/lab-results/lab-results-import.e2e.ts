import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/testStorage';
import { mockGoogleDrive } from '@/src/features/testing/mockGoogleDrive';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  for (const scenario of [
    'valid CBC',
    'unknown unit',
    'unknown biomarker',
  ] as const) {
    test(`${transport} import validates ${scenario} before restoring records`, async ({
      page,
    }) => {
      await clearAppStorage(page);
      await seedTestPatient(page, {
        id: 'cbc-import-patient',
        syncAccount: 'cbc-import-user',
      });
      await seedTestReport(page, {
        id: 'cbc-import-report',
        biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
      });
      // Simulate an externally produced archive with unsupported clinical data.
      if (scenario !== 'valid CBC') {
        await page.evaluate(async (scenario) => {
          const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
          const [row] = await bridge.querySql(
            'SELECT id, fhir_json FROM observations WHERE report_id = ?',
            ['cbc-import-report']
          );
          const observation = JSON.parse(row.fhir_json);
          if (scenario === 'unknown unit') {
            observation.valueQuantity.code = 'g/l-typo';
            observation.valueQuantity.unit = 'g/l-typo';
          } else {
            observation.code = {
              text: 'Unknown Marker',
              coding: [
                {
                  system: 'https://example.org/lab-codes',
                  code: 'unknown',
                  display: 'Unknown Marker',
                },
              ],
            };
          }
          await bridge.executeSql(
            'UPDATE observations SET fhir_json = ? WHERE id = ?',
            [JSON.stringify(observation), row.id]
          );
        }, scenario);
      }
      const config = {
        accessToken: 'synthetic-token',
        userSub: 'cbc-import-user',
      };
      let archive: number[] = [];
      if (transport === 'ZIP') {
        const download = page.waitForEvent('download');
        await page.evaluate(() =>
          (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive()
        );
        archive = Array.from(await readFile((await (await download).path())!));
      } else {
        await mockGoogleDrive(page);
        await page.evaluate(
          (config) =>
            (window as any).__HEALTHY_TEST_BRIDGE__.backupToGoogleDrive(config),
          config
        );
      }
      const restored = await page.evaluate(
        async ({ transport, config, archive }) => {
          const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
          await bridge.clearDatabase();
          let error = '';
          try {
            if (transport === 'ZIP') await bridge.restoreArchive(archive);
            else await bridge.restoreFromGoogleDrive(config);
          } catch (failure) {
            error = (failure as Error).message;
          }
          return {
            error,
            patients: await bridge.querySql('SELECT id FROM patients'),
            reports: await bridge.querySql('SELECT id FROM diagnostic_reports'),
            observations: await bridge.querySql(
              'SELECT fhir_json FROM observations'
            ),
          };
        },
        { transport, config, archive }
      );
      if (scenario === 'valid CBC') {
        expect(restored.error).toBe('');
        expect(restored.reports).toHaveLength(1);
        expect(restored.observations).toHaveLength(1);
        const observation = JSON.parse(restored.observations[0].fhir_json);
        expect(observation.valueQuantity).toMatchObject({
          value: 150,
          code: 'g/L',
        });
        expect(observation.referenceRange[0].low.value).toBe(135);
      } else {
        expect(restored.error).toContain(
          scenario === 'unknown unit'
            ? 'Unsupported unit "g/l-typo"'
            : 'is not in the CBC catalog'
        );
        expect(restored.patients).toHaveLength(0);
        expect(restored.reports).toHaveLength(0);
        expect(restored.observations).toHaveLength(0);
      }
    });
  }
}
