import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  openRoute,
} from '@/src/features/testing/visualTest';

test('Labs Summary page - full and filtered latest results', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    date: '2026-10-02',
    biomarkers: [
      { name: 'Hemoglobin', value: 15.2 },
      { name: 'White Blood Cells', value: 3.1 },
      { name: 'Platelets', value: 480 },
    ],
  });
  await seedTestReport(page, {
    date: '2020-10-02',
    biomarkers: [
      { name: 'Hemoglobin', value: 8 },
      { name: 'Red Blood Cells', value: 4.7 },
    ],
  });
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  await view.getByTestId('labs-summary-result-718-7').waitFor();
  await takeSnapshot(page, 'Labs Summary - all biomarkers', testInfo);
  await view.getByRole('combobox', { name: 'Period' }).selectOption('1');
  await takeSnapshot(page, 'Labs Summary - last month', testInfo);
  await view
    .getByRole('combobox', { name: 'Sort', exact: true })
    .selectOption('lowest');
  await takeSnapshot(page, 'Labs Summary - lowest first', testInfo);
  await page.screenshot({ path: testInfo.outputPath('labs-summary-page.png') });
});
