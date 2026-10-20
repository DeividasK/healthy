import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  openRoute,
} from '@/src/features/testing/testStorage';
import type { Page } from '@playwright/test';

const results = (page: Page) => page.getByTestId('lab-result-results-section');

test.describe('View Lab Result', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('opens from the home card and shows the report details', async ({
    page,
  }) => {
    const { report } = await seedTestReport(page, {
      date: '2026-03-14',
      notes: 'Fasting sample.\nRepeat in three months.',
      serviceProviderName: 'City Lab',
      biomarkers: [
        { name: 'Hemoglobin', value: 14.5, unit: 'g/dL' },
        { name: 'White Blood Cells', value: 12.4, unit: '10*3/uL' },
      ],
    });
    await openRoute(page, '/');
    await page.getByTestId(`view-report-button-${report.id}`).click();
    await expect(page).toHaveURL(new RegExp(`lab-result/${report.id}$`));

    await expect(page.getByTestId('lab-result-title')).toHaveText(
      'Complete blood count (hemogram) panel - Blood by Automated count'
    );
    await expect(page.getByTestId('lab-result-date')).toHaveText(
      'Mar 14, 2026'
    );
    await expect(page.getByTestId('lab-result-status')).toHaveText('Final');
    await expect(page.getByTestId('lab-result-service-provider')).toHaveText(
      'City Lab'
    );
    await expect(page.getByTestId('lab-result-notes')).toHaveText(
      'Fasting sample.\nRepeat in three months.'
    );
    await expect(
      page.getByTestId('lab-result-results-section-count')
    ).toHaveText('2');
    await expect(
      results(page).getByTestId('biomarker-row-718-7')
    ).toContainText('14.5');
    await expect(
      results(page).getByTestId('biomarker-row-6690-2')
    ).toContainText('High');

    await results(page).getByTestId('biomarker-row-718-7').click();
    await expect(page).toHaveURL(/biomarker\/718-7$/);
  });

  test('edits and returns to the updated view', async ({ page }) => {
    const { report } = await seedTestReport(page, {
      biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
    });
    await openRoute(page, `/lab-result/${report.id}`);
    await page.getByTestId('edit-lab-result-button').click();
    await expect(page).toHaveURL(new RegExp(`lab-result/${report.id}/edit`));
    await page.getByTestId('marker-value-input-0').fill('11.2');
    await page.getByTestId('save-button').click();

    await expect(page).toHaveURL(new RegExp(`lab-result/${report.id}$`));
    await expect(
      results(page).getByTestId('biomarker-row-718-7')
    ).toContainText('11.2');
  });

  test('deletes the lab result', async ({ page }) => {
    const { report } = await seedTestReport(page, {
      biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
    });
    await openRoute(page, '/');
    await page.getByTestId(`view-report-button-${report.id}`).click();
    // A report without notes or provider shows neither section.
    await expect(page.getByTestId('lab-result-title')).toBeVisible();
    await expect(page.getByTestId('lab-result-notes-section')).toHaveCount(0);
    await expect(page.getByTestId('lab-result-service-provider')).toHaveCount(
      0
    );
    await page.clock.install();
    await page.getByTestId('delete-lab-result-button').click();
    await expect(page.getByTestId('delete-confirmation-modal')).toBeVisible();
    await page.clock.runFor(5000);
    await page.getByTestId('delete-modal-confirm-button').click();

    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByTestId(`report-card-${report.id}`)).toHaveCount(0);
    await openRoute(page, `/lab-result/${report.id}`);
    await expect(page.getByText('Lab result not found.')).toBeVisible();
  });
});
