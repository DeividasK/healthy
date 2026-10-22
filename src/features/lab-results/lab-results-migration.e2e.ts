import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  openRoute,
} from '@/src/features/testing/testStorage';

// Rewinding the schema needs a page of its own.
test.use({ freshApp: true });

test('migration v21 corrects stored codes and drops copied default ranges', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'legacy-labs-patient' });
  await seedTestReport(page, {
    id: 'legacy-report',
    date: '2026-09-01',
    biomarkers: [
      { name: 'Hemoglobin', value: 150, unit: 'g/L' },
      { name: 'Neutrophils (%)', value: 55 },
      { name: 'Basophils (Absolute)', value: 0.05 },
      // A laboratory's own range survives.
      {
        name: 'White Blood Cells (WBC)',
        value: 6,
        referenceLow: 4,
        referenceHigh: 10,
      },
    ],
  });
  await openRoute(page, '/');
  await expect(page.getByTestId('labs-summary')).toBeVisible();

  // Rewrite the results as the previous version stored them: two tests under
  // another test's code, and the general default range with its flag.
  await page.evaluate(async () => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    const legacy = (code: string, name: string, extra: string) =>
      bridge.executeSql(
        `UPDATE observations SET loinc_code = ?,
           fhir_json = json_set(fhir_json, '$.code.coding[0].code', ? ${extra})
         WHERE name = ?`,
        [code, code, name]
      );
    const range = (low: number, high: number, unit: string) =>
      `, '$.referenceRange', json('[{"low":{"value":${low},"unit":"${unit}","system":"http://unitsofmeasure.org","code":"${unit}"},"high":{"value":${high},"unit":"${unit}","system":"http://unitsofmeasure.org","code":"${unit}"}}]'),
         '$.interpretation', json('[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation","code":"N","display":"Normal"}]}]')`;
    await legacy('718-7', 'Hemoglobin (Hgb)', range(135, 175, 'g/L'));
    await legacy('751-8', 'Neutrophils (%)', range(40, 70, '%'));
    await legacy('702-1', 'Basophils (Absolute)', '');
    await bridge.executeSql('PRAGMA user_version = 20');
  });

  // A full load runs the migration.
  await page.goto('/');
  await expect(page.getByTestId('labs-summary')).toBeVisible();
  const rows: { loinc_code: string; name: string; fhir_json: string }[] =
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT loinc_code, name, fhir_json FROM observations ORDER BY name'
      )
    );
  const byName = Object.fromEntries(
    rows.map((row) => [
      row.name,
      { code: row.loinc_code, resource: JSON.parse(row.fhir_json) },
    ])
  );
  expect(byName['Neutrophils (%)'].code).toBe('770-8');
  expect(byName['Neutrophils (%)'].resource.code.coding[0].code).toBe('770-8');
  expect(byName['Basophils (Absolute)'].code).toBe('704-7');
  for (const name of ['Hemoglobin (Hgb)', 'Neutrophils (%)']) {
    expect(byName[name].resource.referenceRange).toBeUndefined();
    expect(byName[name].resource.interpretation).toBeUndefined();
  }
  expect(
    byName['White Blood Cells (WBC)'].resource.referenceRange[0].low.value
  ).toBe(4);

  // The results open under their corrected codes.
  await openRoute(page, '/biomarker/770-8');
  await expect(page.getByTestId('biomarker-title')).toHaveText(
    'Neutrophils (%)'
  );
});
