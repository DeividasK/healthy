import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  connectTestSync,
} from '@/src/features/testing/testStorage';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  for (const scenario of [
    'valid CBC',
    transport === 'ZIP' ? 'unknown unit' : 'unknown biomarker',
  ] as const) {
    test(`${transport} import validates ${scenario} before restoring records`, async ({
      page,
      consoleMonitor,
    }) => {
      await seedTestPatient(page, { id: 'cbc-import-patient' });
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
      let archive: number[] = [];
      if (transport === 'ZIP') {
        const download = page.waitForEvent('download');
        await page.evaluate(() =>
          (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive()
        );
        archive = Array.from(await readFile((await (await download).path())!));
      } else {
        await connectTestSync(page);
        await page.evaluate(() =>
          (window as any).__HEALTHY_TEST_BRIDGE__.syncNow()
        );
        // Sync defers an invalid change instead of failing the whole round.
        consoleMonitor.ignore('Deferred sync change DiagnosticReport/');
      }
      const restored = await page.evaluate(
        async ({ transport, archive }) => {
          const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
          await bridge.clearDatabase();
          let error = '';
          try {
            if (transport === 'ZIP') await bridge.restoreArchive(archive);
            else await bridge.syncNow();
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
            deferred: await bridge.querySql(
              'SELECT error FROM sync_pending_apply'
            ),
          };
        },
        { transport, archive }
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
      } else if (transport === 'ZIP') {
        expect(restored.error).toContain('Unsupported unit "g/l-typo"');
        expect(restored.patients).toHaveLength(0);
        expect(restored.reports).toHaveLength(0);
        expect(restored.observations).toHaveLength(0);
      } else {
        // The profile syncs; the invalid report waits, unapplied.
        expect(restored.error).toBe('');
        expect(restored.patients).toHaveLength(1);
        expect(restored.reports).toHaveLength(0);
        expect(restored.observations).toHaveLength(0);
        expect(restored.deferred).toHaveLength(1);
        expect(restored.deferred[0].error).toContain(
          'is not in the CBC catalog'
        );
      }
    });
  }
}
