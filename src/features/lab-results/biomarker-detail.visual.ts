import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/visualTest';

test('Biomarker detail - Red Blood Cells history', async ({
  page,
}, testInfo) => {
  await clearAppStorage(page);
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
