import { strToU8, zipSync } from 'fflate';
import {
  test,
  expect,
  seedTestPatient,
  seedTestTreatment,
} from '@/src/features/testing/testStorage';

for (const scenario of [
  'legacy-v10',
  'legacy-v11',
  'partial-v11',
  'current-v11',
]) {
  test(`repairs ${scenario} without losing treatments`, async ({ page }) => {
    await seedTestPatient(page, { id: 'migration-patient' });
    await seedTestTreatment(page, {
      id: 'existing-treatment',
      title: 'Existing treatment',
      authoredOn: '2026-01-02',
    });
    await seedTestTreatment(page, {
      id: 'undated-treatment',
      title: 'Undated treatment',
    });
    await page.goto('/profile');
    await expect(page.getByTestId('edit-profile-button').first()).toBeVisible();
    const before = await page.evaluate(async (scenario) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.executeSql(
        `UPDATE medication_requests SET fhir_json = json_remove(fhir_json, '$.authoredOn') WHERE id = 'undated-treatment'`
      );
      const rows = await bridge.querySql(
        'SELECT id, fhir_json, created_at, updated_at FROM medication_requests ORDER BY id'
      );
      if (scenario.startsWith('legacy')) {
        await bridge.executeSql(
          'DROP INDEX idx_medication_requests_consultation_id'
        );
        for (const column of [
          'authored_on',
          'display_label',
          'intent',
          'status',
          'consultation_id',
        ]) {
          await bridge.executeSql(
            `ALTER TABLE medication_requests DROP COLUMN ${column}`
          );
        }
        // A superseded required label column would also block new INSERTs.
        await bridge.executeSql(
          "ALTER TABLE medication_requests ADD COLUMN title TEXT NOT NULL DEFAULT 'Legacy'"
        );
      }
      if (scenario === 'partial-v11') {
        // Reproduce the database after the earlier authored_on-only repair.
        await bridge.executeSql(
          'ALTER TABLE medication_requests RENAME COLUMN display_label TO title'
        );
      }
      await bridge.executeSql(
        `PRAGMA user_version = ${scenario === 'legacy-v10' ? 10 : 11}`
      );
      return rows;
    }, scenario);

    await page.goto('/');
    await expect(
      page.getByTestId('treatment-card-existing-treatment')
    ).toBeVisible();
    const after = await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      return {
        version: await bridge.querySql('PRAGMA user_version'),
        rows: await bridge.querySql(
          'SELECT id, fhir_json, created_at, updated_at FROM medication_requests ORDER BY id'
        ),
        dates: await bridge.querySql(
          'SELECT authored_on FROM medication_requests ORDER BY id'
        ),
      };
    });
    expect(after.version[0].user_version).toBeGreaterThanOrEqual(12);
    expect(after.rows).toEqual(before);
    expect(after.dates[0].authored_on).toBe('2026-01-02');
    if (scenario.startsWith('legacy')) {
      expect(after.dates[1].authored_on).toBe(
        before[1].created_at.slice(0, 10)
      );
    }

    // Archive compatibility is independent of the source schema; exercise it once
    // after a real legacy repair, while every variant retains restart/edit checks.
    if (scenario === 'legacy-v10') {
      // Older v2 archives, including the supplied backup, contain no treatments.
      const olderArchive = zipSync({
        'manifest.json': strToU8(
          JSON.stringify({ version: 2, fhirVersion: '5.0.0' })
        ),
        'records/patient.json': strToU8(
          JSON.stringify({
            resourceType: 'Patient',
            id: 'restored-patient',
            name: [{ given: ['Synthetic'], family: 'Restore' }],
          })
        ),
      });
      const olderResult = await page.evaluate(
        (bytes) =>
          (window as any).__HEALTHY_TEST_BRIDGE__.restoreArchive(bytes),
        Array.from(olderArchive)
      );
      expect(olderResult.patients).toBe(1);
      expect(olderResult.medicationRequests).toBe(0);

      const archive = zipSync({
        'manifest.json': strToU8(
          JSON.stringify({ version: 2, fhirVersion: '5.0.0' })
        ),
        'records/medication_request_restored.json': strToU8(
          JSON.stringify({
            patientId: 'migration-patient',
            resource: {
              resourceType: 'MedicationRequest',
              id: 'restored-treatment',
              subject: { reference: 'Patient/migration-patient' },
              medication: { concept: { text: 'Restored treatment' } },
              status: 'unknown',
              intent: 'plan',
              authoredOn: '2026-02-03',
            },
          })
        ),
      });
      const restored = await page.evaluate(
        (bytes) =>
          (window as any).__HEALTHY_TEST_BRIDGE__.restoreArchive(bytes),
        Array.from(archive)
      );
      expect(restored.medicationRequests).toBe(1);
    }
    await page.reload();
    if (scenario === 'legacy-v10') {
      await expect(
        page.getByTestId('treatment-card-restored-treatment')
      ).toBeVisible();
    }
    await expect(
      page.getByTestId('treatment-card-existing-treatment')
    ).toBeVisible();
    const repeated = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql('PRAGMA user_version')
    );
    expect(repeated[0].user_version).toBeGreaterThanOrEqual(12);

    await page.goto('/treatment/add');
    await page
      .getByTestId('treatment-title-input')
      .fill('Treatment after repair');
    await page.getByTestId('save-treatment-button').click();
    await expect(page).not.toHaveURL(/treatment\/add/);
    await page.goto('/');
    await expect(
      page.getByText('Treatment after repair', { exact: true })
    ).toBeVisible();
    await page.getByTestId('treatment-open-existing-treatment').click();
    await page.goto('/treatment/existing-treatment/edit');
    await page.getByTestId('treatment-title-input').fill('Edited after repair');
    await page.getByTestId('save-treatment-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    await page.reload();
    await expect(
      page.getByText('Edited after repair', { exact: true }).first()
    ).toBeVisible();
  });
}

test('v16 backfills taking periods from the earliest log or prescribed start and captures them for sync', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'migration-patient' });
  for (const id of [
    'logged',
    'planned',
    'earlier-log',
    'earlier-plan',
    'not-started',
    'stopped',
  ]) {
    await seedTestTreatment(page, {
      id,
      title: id,
      status: id === 'stopped' ? 'stopped' : 'active',
    });
  }
  const before = await page.evaluate(async () => {
    const b = (window as any).__HEALTHY_TEST_BRIDGE__;
    for (const id of ['logged', 'earlier-log', 'earlier-plan', 'stopped']) {
      await b.seedTreatmentLog({
        treatmentId: id,
        date: '2026-10-05',
        answer: 'taken',
      });
    }
    await b.executeSql(
      `UPDATE medication_requests SET fhir_json = json_set(fhir_json, '$.effectiveDosePeriod.start', '2026-10-07') WHERE id IN ('planned', 'earlier-log')`
    );
    await b.executeSql(
      `UPDATE medication_requests SET fhir_json = json_set(fhir_json, '$.effectiveDosePeriod.start', '2026-10-01') WHERE id = 'earlier-plan'`
    );
    const rows = await b.querySql(
      'SELECT id, fhir_json FROM medication_requests ORDER BY id'
    );
    await b.executeSql('DROP TABLE medication_statements');
    await b.executeSql('PRAGMA user_version = 15');
    return rows;
  });
  await page.reload();
  await expect(page.getByTestId('treatment-card-logged')).toBeVisible();
  const readMigration = () =>
    page.evaluate(async () => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      return {
        version: await b.querySql('PRAGMA user_version'),
        periods: await b.querySql(
          'SELECT id, medication_request_id, start_date, fhir_json FROM medication_statements ORDER BY medication_request_id'
        ),
        requests: await b.querySql(
          'SELECT id, fhir_json FROM medication_requests ORDER BY id'
        ),
        dirty: await b.querySql(
          "SELECT resource_id FROM sync_dirty WHERE resource_type = 'MedicationStatement' ORDER BY resource_id"
        ),
      };
    });
  const result = await readMigration();
  expect(result.version[0].user_version).toBe(16);
  expect(result.requests).toEqual(before);
  expect(
    result.periods.map((row: any) => [
      row.medication_request_id,
      row.start_date,
    ])
  ).toEqual([
    ['earlier-log', '2026-10-05'],
    ['earlier-plan', '2026-10-01'],
    ['logged', '2026-10-05'],
    ['planned', '2026-10-07'],
  ]);
  for (const row of result.periods) {
    expect(row.id).toBe(`use-${row.medication_request_id}-backfill`);
    expect(JSON.parse(row.fhir_json)).toMatchObject({
      resourceType: 'MedicationStatement',
      status: 'recorded',
      subject: { reference: 'Patient/migration-patient' },
      derivedFrom: [
        { reference: `MedicationRequest/${row.medication_request_id}` },
      ],
      effectivePeriod: { start: row.start_date },
      adherence: {
        code: {
          coding: [
            {
              system:
                'http://hl7.org/fhir/CodeSystem/medication-statement-adherence',
              code: 'taking',
            },
          ],
        },
      },
    });
  }
  expect(result.dirty.map((row: any) => row.resource_id)).toEqual(
    result.periods.map((row: any) => row.id)
  );
  await page.reload();
  await expect(page.getByTestId('treatment-card-logged')).toBeVisible();
  expect(await readMigration()).toEqual(result);
});
