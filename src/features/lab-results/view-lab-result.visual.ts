import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/visualTest';

test.describe('View Lab Result - Visual Regression', () => {
  test('Notes, provider and results', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const { report } = await seedTestReport(page, {
      date: '2026-03-14',
      notes: 'Fasting sample taken at 8am.\nRepeat in three months.',
      serviceProviderName: 'City Lab',
      biomarkers: [
        { name: 'Hemoglobin', value: 14.5, unit: 'g/dL' },
        { name: 'White Blood Cells', value: 12.4, unit: '10*3/uL' },
        { name: 'Red Blood Cells', value: 3.9 },
      ],
    });

    await page.goto(`/lab-result/${report.id}`);
    await page.getByTestId('lab-result-title').waitFor();
    await takeSnapshot(page, 'Lab Result View - Details', testInfo);

    await page.setViewportSize({ width: 1280, height: 900 });
    await takeSnapshot(page, 'Lab Result View - Wide layout', testInfo);
  });
});
