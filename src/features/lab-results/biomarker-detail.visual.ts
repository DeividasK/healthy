import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  evaluateBridge,
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

test('Biomarker detail - Regional range', async ({ page }, testInfo) => {
  await seedTestPatient(page);
  await evaluateBridge(page, (bridge) =>
    bridge.saveProfileSettings({ rangeRegion: 'anz' })
  );
  await seedTestReport(page, {
    id: 'potassium-visual',
    date: '2026-10-01',
    biomarkers: [{ name: 'Potassium', value: 5.15, unit: 'mmol/L' }],
  });
  await page.goto('/biomarker/2823-3');
  await page.getByTestId('learn-toggle-range-source').click();
  await page.getByTestId('biomarker-range-region-source').waitFor();
  await takeSnapshot(page, 'Biomarker detail - Regional range', testInfo);
});
