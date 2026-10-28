import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/visualTest';
import { expandBiomarkerGroups } from '@/src/features/testing/testSections';

test('Labs Summary page - full and filtered latest results', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestReport(page, {
    date: '2026-10-02',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 15.2,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
      {
        name: 'White Blood Cells',
        value: 3.1,
        referenceLow: 4.5,
        referenceHigh: 11,
      },
      { name: 'Platelets', value: 480, referenceLow: 150, referenceHigh: 450 },
    ],
  });
  await seedTestReport(page, {
    date: '2020-10-02',
    biomarkers: [
      { name: 'Hemoglobin', value: 8, referenceLow: 11.6, referenceHigh: 16.6 },
      {
        name: 'Red Blood Cells',
        value: 4.7,
        referenceLow: 3.92,
        referenceHigh: 5.65,
      },
    ],
  });
  await page.goto('/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  await view.getByTestId('labs-summary-groups-inRange-toggle').waitFor();
  await takeSnapshot(page, 'Labs Summary - collapsed groups', testInfo);
  await expandBiomarkerGroups(view.getByTestId('labs-summary'));
  await view.getByTestId('labs-summary-result-718-7').waitFor();
  await takeSnapshot(page, 'Labs Summary - all biomarkers', testInfo);
  await view.getByTestId('labs-summary-filter-button').click();
  const filters = page.getByTestId('labs-summary-filters');
  await filters
    .getByRole('combobox', { name: 'Time period' })
    .selectOption('6');
  await filters.getByRole('combobox', { name: 'Sort' }).selectOption('oldest');
  await takeSnapshot(page, 'Labs Summary - filters', testInfo);
  await filters.getByTestId('labs-summary-filters-done').click();
  await filters.waitFor({ state: 'hidden' });
  await takeSnapshot(
    page,
    'Labs Summary - last 6 months, oldest first',
    testInfo
  );
  const search = view.getByRole('textbox', { name: 'Search', exact: true });
  await search.fill('Hemoglobin');
  await view.getByTestId('labs-summary-result-718-7').waitFor();
  await takeSnapshot(page, 'Labs Summary - search match', testInfo);
  await search.fill('unknown biomarker');
  await view.getByTestId('labs-summary-no-results').waitFor();
  await takeSnapshot(page, 'Labs Summary - no search results', testInfo);
  await page.screenshot({ path: testInfo.outputPath('labs-summary-page.png') });
});
