import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/visualTest';

test('Biomarker detail - Mixed hemoglobin units and empty education', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'hemoglobin-visual-first',
    date: '2026-09-01',
    biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
  });
  await seedTestReport(page, {
    id: 'hemoglobin-visual-second',
    date: '2026-10-01',
    biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
  });
  await page.goto('/biomarker/718-7');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - Mixed hemoglobin units and empty education',
    testInfo
  );
});

test('Biomarker detail - Red Blood Cells history', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'rbc-visual-first',
    date: '2026-08-01',
    biomarkers: [{ name: 'Red Blood Cells', value: 4.5 }],
  });
  await seedTestReport(page, {
    id: 'rbc-visual-second',
    date: '2026-09-01',
    biomarkers: [{ name: 'Red Blood Cells', value: 4.8 }],
  });
  await page.goto('/biomarker/789-8');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - Red Blood Cells history',
    testInfo
  );
});

test('Biomarker detail - LOINC test outside the catalog', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  const glucose = {
    loinc: '2339-0',
    name: 'Glucose [Mass/volume] in Blood',
    unit: 'mg/dL',
    referenceLow: 70,
    referenceHigh: 99,
  };
  await seedTestReport(page, {
    id: 'loinc-visual-first',
    date: '2026-08-01',
    biomarkers: [{ ...glucose, value: 104 }],
  });
  await seedTestReport(page, {
    id: 'loinc-visual-second',
    date: '2026-10-01',
    biomarkers: [{ ...glucose, value: 92 }],
  });
  await page.goto('/biomarker/2339-0');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - LOINC test outside the catalog',
    testInfo
  );
});

test('Biomarker detail - Calculated atherogenic index', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    id: 'aip-visual',
    date: '2026-06-01',
    biomarkers: [
      { name: 'Triglycerides', value: 1, unit: 'mmol/L' },
      { name: 'HDL', value: 2.14, unit: 'mmol/L' },
    ],
  });
  await page.goto('/biomarker/aip');
  await page.getByTestId('biomarker-title').waitFor();
  await takeSnapshot(
    page,
    'Biomarker detail - Calculated atherogenic index',
    testInfo
  );
});
