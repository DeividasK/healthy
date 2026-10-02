import { test, expect } from '@playwright/test';

test.describe('Edit Lab Results Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('should replace "CBC Panel" badge with "Edit" icon and allow editing existing report results', async ({
    page,
  }) => {
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        consoleWarnings.push(msg.text());
      }
    });

    // 1. Create an initial report
    await page.goto('/lab-result/add');
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('14.5');

    await searchInput.fill('WBC');
    await page.getByTestId('autocomplete-item-cbc_wbc').click();
    await page.getByTestId('marker-value-input-1').fill('6.8');

    // Add note
    const plusBtn = page.getByTestId('plus-menu-button');
    await plusBtn.click();
    await page.getByTestId('menu-add-notes').click();
    await page.getByTestId('notes-input').fill('Initial checkup note');

    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);

    // 2. On homepage: "CBC Panel" badge must NOT exist
    await expect(page.getByText('CBC Panel')).not.toBeVisible();

    // 3. Edit icon must be present on the report card
    const editBtn = page.locator('[data-testid^="edit-report-button-"]');
    await expect(editBtn).toBeVisible();

    // 4. Click Edit icon -> navigates to edit screen
    await editBtn.click();
    await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);
    await expect(page.getByText('Edit Lab Results')).toBeVisible();

    // 5. Existing values should be populated
    await expect(page.getByTestId('marker-card-0')).toContainText(
      'Hemoglobin (Hgb)'
    );
    await expect(page.getByTestId('marker-value-input-0')).toHaveValue('14.5');
    await expect(page.getByTestId('marker-card-1')).toContainText(
      'White Blood Cells (WBC)'
    );
    await expect(page.getByTestId('marker-value-input-1')).toHaveValue('6.8');
    await expect(page.getByTestId('notes-input')).toHaveValue(
      'Initial checkup note'
    );

    // 6. Modify values: update Hemoglobin from 14.5 to 16.2
    await page.getByTestId('marker-value-input-0').fill('16.2');

    // Remove WBC
    await page.getByTestId('remove-marker-1').click();
    await expect(page.getByText('White Blood Cells (WBC)')).not.toBeVisible();

    // Add Platelets: 250
    await searchInput.fill('Platelets');
    await page.getByTestId('autocomplete-item-cbc_platelets').click();
    await page.getByTestId('marker-value-input-1').fill('250');

    // Update note
    await page.getByTestId('notes-input').fill('Updated checkup note');

    // 7. Save modifications
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);

    // 8. Verify updated report on homepage
    await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
    await expect(page.getByText('16.2')).toBeVisible();
    await expect(page.getByText('14.5')).not.toBeVisible();

    await expect(page.getByText('Platelets (PLT)')).toBeVisible();
    await expect(page.getByText('250')).toBeVisible();

    await expect(page.getByText('White Blood Cells (WBC)')).not.toBeVisible();
    await expect(page.getByText('"Updated checkup note"')).toBeVisible();

    // 9. Verify persistence across page reload
    await page.reload();
    await expect(page.getByText('16.2')).toBeVisible();
    await expect(page.getByText('250')).toBeVisible();
    await expect(page.getByText('White Blood Cells (WBC)')).not.toBeVisible();
    await expect(page.getByText('"Updated checkup note"')).toBeVisible();

    // 10. Verify no shadow*, pointerEvents, or Blocked aria-hidden console warnings occurred
    const problematicWarnings = consoleWarnings.filter(
      (w) =>
        w.includes('shadow*') ||
        w.includes('pointerEvents') ||
        w.includes('Blocked aria-hidden')
    );
    expect(problematicWarnings).toEqual([]);
  });

  test('should preserve exact selected date without shifting back by a day across multiple edits/saves', async ({
    page,
  }) => {
    await page.goto('/lab-result/add');

    // 1. Select specific date: 2026-09-26
    const datePicker = page.getByTestId('date-picker-button');
    const dateInput = datePicker.locator('input[type="date"]');
    await dateInput.fill('2026-09-26');

    // Button label and native input value should both reflect Sep 26, 2026
    await expect(datePicker).toContainText('Sep 26, 2026');
    await expect(dateInput).toHaveValue('2026-09-26');

    // Add a marker and value
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('15.1');

    // 2. Save
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);

    // 3. Homepage should display Sep 26, 2026 (NOT Sep 25)
    await expect(page.getByText('Sep 26, 2026')).toBeVisible();
    await expect(page.getByText('Sep 25, 2026')).not.toBeVisible();

    // 4. Open in edit mode
    const editBtn = page.locator('[data-testid^="edit-report-button-"]');
    await editBtn.click();
    await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);

    // Date in edit mode should still be Sep 26, 2026 and native input 2026-09-26
    const editDatePicker = page.getByTestId('date-picker-button');
    const editDateInput = editDatePicker.locator('input[type="date"]');
    await expect(editDatePicker).toContainText('Sep 26, 2026');
    await expect(editDateInput).toHaveValue('2026-09-26');

    // 5. Save again without modifying date
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);

    // Homepage should STILL display Sep 26, 2026
    await expect(page.getByText('Sep 26, 2026')).toBeVisible();
    await expect(page.getByText('Sep 25, 2026')).not.toBeVisible();

    // 6. Edit and save one more time to be 100% certain it doesn't drift
    await editBtn.click();
    await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);
    await expect(page.getByTestId('date-picker-button')).toContainText(
      'Sep 26, 2026'
    );
    await expect(
      page.getByTestId('date-picker-button').locator('input[type="date"]')
    ).toHaveValue('2026-09-26');

    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Sep 26, 2026')).toBeVisible();
    await expect(page.getByText('Sep 25, 2026')).not.toBeVisible();
  });
});
