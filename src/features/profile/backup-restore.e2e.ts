import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  seedEveryResource,
  openRoute,
  snapshotClinicalTables,
  exportTestArchive,
  connectTestSync,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

/** Rewrites the seeded CBC observation as an external source might. */
const corruptObservation = (page: Page, scenario: 'unit' | 'biomarker') =>
  bridge(
    page,
    async (b, scenario) => {
      const [row] = await b.querySql('SELECT id, fhir_json FROM observations');
      const observation = JSON.parse(row.fhir_json);
      if (scenario === 'unit') {
        observation.valueQuantity.code = 'g/l-typo';
        observation.valueQuantity.unit = 'g/l-typo';
      } else {
        observation.code = {
          text: 'Unknown Marker',
          coding: [
            { system: 'https://example.org/lab-codes', code: 'unknown' },
          ],
        };
      }
      await b.executeSql('UPDATE observations SET fhir_json = ? WHERE id = ?', [
        JSON.stringify(observation),
        row.id,
      ]);
    },
    scenario
  );

const restoredRows = (page: Page) =>
  bridge(page, async (b) => ({
    patients: await b.querySql('SELECT id FROM patients'),
    reports: await b.querySql('SELECT id FROM diagnostic_reports'),
    observations: await b.querySql('SELECT id FROM observations'),
    deferred: await b.querySql('SELECT error FROM sync_pending_apply'),
  }));

test('a ZIP backup restores every resource exactly', async ({ page }) => {
  await seedEveryResource(page);
  const original = await snapshotClinicalTables(page);
  // The fixture fills every clinical table, so none goes untested.
  for (const [table, rows] of Object.entries(original))
    expect(rows, table).not.toHaveLength(0);
  const archive = await exportTestArchive(page);

  const summary = await bridge(
    page,
    async (b, archive) => {
      await b.clearDatabase();
      return await b.restoreArchive(archive);
    },
    archive
  );
  expect(summary).toMatchObject({
    patients: 1,
    consultations: 3,
    clinicalDocuments: 1,
  });
  expect(await snapshotClinicalTables(page)).toEqual(original);
});

test('a backup file restore blocks the app, then opens the record', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'file-restore-patient' });
  await seedTestCondition(page, {
    id: 'file-restore-condition',
    patientId: 'file-restore-patient',
    title: 'Asthma',
  });
  const archive = await exportTestArchive(page);
  await bridge(page, (b) => b.clearDatabase());
  await openRoute(page, '/profile/restore');

  // Hold the file read so the restore stays in progress until released.
  await page.evaluate(() => {
    const gate = new Promise<void>(
      (resolve) => ((window as any).__releaseFileRead = resolve)
    );
    const read = Blob.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function (this: File) {
      delete (File.prototype as any).arrayBuffer;
      await gate;
      return read.call(this);
    };
  });
  try {
    await page.locator('#profile-restore-zip-file-input').setInputFiles({
      name: 'healthy-backup.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(archive),
    });
    await expect(page.getByTestId('restore-file-busy')).toBeVisible();
    // The spinner covers the screen: its back button cannot be reached.
    const backCovered = await page
      .getByTestId('back-button')
      .evaluate((button) => {
        const { x, y, width, height } = button.getBoundingClientRect();
        const top = document.elementFromPoint(x + width / 2, y + height / 2);
        return !button.contains(top);
      });
    expect(backCovered).toBe(true);
  } finally {
    await page.evaluate(() => (window as any).__releaseFileRead?.());
  }

  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByTestId('restore-file-busy')).toHaveCount(0);
  await expect(
    page.getByTestId('condition-card-file-restore-condition')
  ).toContainText('Asthma');
});

test('a ZIP restore rejects an unsupported unit before writing anything', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'cbc-import-patient' });
  await seedTestReport(page, {
    biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
  });
  await corruptObservation(page, 'unit');
  const archive = await exportTestArchive(page);
  const error = await bridge(
    page,
    async (b, archive) => {
      await b.clearDatabase();
      try {
        await b.restoreArchive(archive);
        return '';
      } catch (failure) {
        return (failure as Error).message;
      }
    },
    archive
  );
  expect(error).toContain('Unsupported unit "g/l-typo"');
  expect(await restoredRows(page)).toMatchObject({
    patients: [],
    reports: [],
    observations: [],
  });
});

test('a Drive restore defers an unknown biomarker and restores the rest', async ({
  page,
  consoleMonitor,
}) => {
  await seedTestPatient(page, { id: 'cbc-import-patient' });
  await seedTestReport(page, {
    biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
  });
  await corruptObservation(page, 'biomarker');
  await connectTestSync(page);
  await bridge(page, (b) => b.syncNow());
  // Sync defers an invalid change instead of failing the whole round.
  consoleMonitor.ignore('Deferred sync change DiagnosticReport/');
  await bridge(page, async (b) => {
    await b.clearDatabase();
    await b.syncAllProfiles();
  });
  const restored = await restoredRows(page);
  expect(restored).toMatchObject({ reports: [], observations: [] });
  expect(restored.patients).toHaveLength(1);
  expect(restored.deferred).toHaveLength(1);
  expect(restored.deferred[0].error).toContain(
    'is not in the biomarker catalog'
  );
});
