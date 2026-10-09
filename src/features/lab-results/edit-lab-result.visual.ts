import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/visualTest';

test.describe('Edit Lab Result View - Visual Regression', () => {
  test('Add Report View - Edit Existing Mode', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    const bundle = await seedTestReport(page, {
      id: 'report-edit-test',
      date: '2026-10-02',
      biomarkers: [
        { name: 'Hemoglobin', value: 13.8 },
        { name: 'Platelets', value: 210 },
      ],
      notes: 'Initial checkup notes for editing',
    });

    await page.goto(`/lab-result/${bundle.report.id}/edit`);
    await page.getByTestId('marker-card-0').waitFor();

    await takeSnapshot(page, 'Add Report View - Edit Existing Mode', testInfo);
  });
});
