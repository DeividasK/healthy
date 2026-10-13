import {
  test,
  expect,
  clearAppStorage,
} from '@/src/features/testing/testStorage';
import {
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/testSeed';

test.describe('Biomarker detail', () => {
  test('opens a biomarker and shows its description, history, and trend', async ({
    page,
  }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    await seedTestReport(page, {
      id: 'rbc-history-low',
      date: '2026-07-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 3.8 }],
    });
    await seedTestReport(page, {
      id: 'rbc-history-first',
      date: '2026-08-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 4.5 }],
    });
    await seedTestReport(page, {
      id: 'rbc-history-second',
      date: '2026-09-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 4.8 }],
    });
    await seedTestReport(page, {
      id: 'rbc-history-high',
      date: '2026-10-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 6.1 }],
    });

    await page.goto('/');
    const row = page.getByTestId('biomarker-row-789-8').first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.getByTestId('biomarker-title')).toHaveText(
      'Red Blood Cells (RBC)'
    );
    await page.getByTestId('floating-add-button').click();
    await expect(page.getByTestId('menu-add-lab-results')).toHaveText(
      'Add Lab Results'
    );
    await page.getByTestId('floating-add-menu-backdrop').click();
    await expect(
      page.getByText(
        'Number of oxygen-carrying red blood cells per volume of blood.'
      )
    ).toBeVisible();
    await expect(page.getByTestId('biomarker-latest')).toBeVisible();
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('6.1');
    await expect(page.getByTestId('biomarker-latest-unit')).toHaveText(
      '10*6/uL'
    );
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'High'
    );
    await expect(page.getByTestId('biomarker-learn')).toBeVisible();
    const whyItMatters = page.getByText(
      /carries oxygen from the lungs to the body’s tissues/
    );
    const whyItMattersToggle = page.getByTestId('learn-toggle-why-it-matters');
    await expect(whyItMattersToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(whyItMatters).toBeHidden();
    await whyItMattersToggle.click();
    await expect(whyItMatters).toBeVisible();
    await expect(whyItMattersToggle).toHaveAttribute('aria-expanded', 'true');
    await whyItMattersToggle.click();
    await expect(whyItMatters).toBeHidden();
    await expect(page.getByTestId('biomarker-chart')).toBeVisible();
    await expect(page.getByText('4.8')).toBeVisible();
    await expect(page.getByText('4.5')).toBeVisible();
    await expect(page.getByText('Low', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Normal', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText('High', { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-testid^="biomarker-history-range-"]').first()
    ).toBeVisible();

    const historyListToggle = page.getByTestId('biomarker-history-list-toggle');
    const historyList = page.getByTestId('biomarker-history-list');
    await expect(historyListToggle).toHaveText('List');
    await expect(historyListToggle).toHaveAttribute('aria-expanded', 'true');
    await historyListToggle.click();
    await expect(historyList).toBeHidden();
    await expect(historyListToggle).toHaveAttribute('aria-expanded', 'false');
    await historyListToggle.click();
    await expect(historyList).toBeVisible();

    await page.getByTestId('biomarker-point-2').hover();
    const tooltip = page.getByTestId('biomarker-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('2026');
    await expect(tooltip).toContainText('4.8');
  });
});
