import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage, createReportViaUI } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Edit Lab Result View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Add Report View - Edit Existing Mode', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await createReportViaUI(page, {
      biomarkers: [
        { name: 'Hemoglobin', value: '13.8' },
        { name: 'Platelets', value: '210' },
      ],
      notes: 'Initial checkup notes for editing',
    });

    // Tap edit button on Home card
    const editBtn = page
      .locator('[data-testid^="edit-report-button-"]')
      .first();
    await editBtn.click();
    await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);

    await expect(page.getByText('Edit Lab Results')).toBeVisible();
    await expect(page.getByTestId('marker-card-0')).toContainText(
      'Hemoglobin (Hgb)'
    );
    await expect(page.getByTestId('marker-value-input-0')).toHaveValue('13.8');
    await expect(page.getByTestId('notes-input')).toHaveValue(
      'Initial checkup notes for editing'
    );

    await takeSnapshot(page, 'Add Report View - Edit Existing Mode', testInfo);
  });
});
