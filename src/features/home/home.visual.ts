import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage, createReportViaUI } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Home View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Home View - Empty State', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await page.goto('/');

    await expect(page.getByText('Nothing to show yet')).toBeVisible();
    await expect(page.getByTestId('floating-add-button')).toBeVisible();

    await takeSnapshot(page, 'Home View - Empty State', testInfo);
  });

  test('Home View - Populated with Single Report', async ({
    page,
  }, testInfo) => {
    await clearAppStorage(page);
    await createReportViaUI(page, {
      biomarkers: [
        { name: 'Hemoglobin', value: '14.5' },
        { name: 'White Blood Cells', value: '6.8' },
      ],
      notes: 'Routine morning blood test',
    });

    await page.goto('/');
    await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
    await expect(page.getByText('"Routine morning blood test"')).toBeVisible();

    await takeSnapshot(page, 'Home View - Populated Single Report', testInfo);
  });

  test('Home View - Multi-Report with All Status Badges', async ({
    page,
  }, testInfo) => {
    await clearAppStorage(page);
    await createReportViaUI(page, {
      biomarkers: [
        { name: 'Hemoglobin', value: '15.2' },
        { name: 'White Blood Cells', value: '3.1' },
        { name: 'Platelets', value: '480' },
      ],
      notes: 'Follow-up consultation notes',
    });

    await createReportViaUI(page, {
      biomarkers: [
        { name: 'Red Blood Cells', value: '4.7' },
        { name: 'Hematocrit', value: '41.5' },
      ],
    });

    await page.goto('/');
    await expect(
      page.getByText('Normal', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText('Low', { exact: true })).toBeVisible();
    await expect(page.getByText('High', { exact: true })).toBeVisible();

    await takeSnapshot(
      page,
      'Home View - Multi-Report with Status Badges',
      testInfo
    );
  });
});
