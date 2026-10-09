import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
} from '@/src/features/testing/testStorage';

test.describe('Edit Lab Results Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test(
    'should replace "CBC Panel" badge with "Edit" icon and allow editing existing report results',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Create an initial report with Hemoglobin and WBC', async () => {
        await page.getByTestId('floating-add-button').click();
        await page.getByTestId('menu-add-lab-results').click();
        const searchInput = page.getByTestId('test-search-input');
        await searchInput.fill('Hemoglobin');
        await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
        await page.getByTestId('marker-value-input-0').fill('14.5');

        await searchInput.fill('WBC');
        await page.getByTestId('autocomplete-item-cbc_wbc').click();
        await page.getByTestId('marker-value-input-1').fill('6.8');

        const plusBtn = page.getByTestId('plus-menu-button');
        await plusBtn.click();
        await page.getByTestId('menu-add-notes').click();
        await page.getByTestId('notes-input').fill('Initial checkup note');

        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
      });

      await test.step('Verify Edit button exists on report card', async () => {
        await expect(page.getByText('CBC Panel')).not.toBeVisible();
        const editBtn = page.getByTestId(/^edit-report-button-/);
        await expect(editBtn).toBeVisible();
        await editBtn.click();
        await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);
        await expect(page.getByText('Edit Lab Results')).toBeVisible();
      });

      await test.step('Verify populated values and modify them', async () => {
        await expect(page.getByTestId('marker-card-0')).toContainText(
          'Hemoglobin (Hgb)'
        );
        await expect(page.getByTestId('marker-value-input-0')).toHaveValue(
          '14.5'
        );
        await expect(page.getByTestId('marker-card-1')).toContainText(
          'White Blood Cells (WBC)'
        );
        await expect(page.getByTestId('marker-value-input-1')).toHaveValue(
          '6.8'
        );
        await expect(page.getByTestId('notes-input')).toHaveValue(
          'Initial checkup note'
        );

        await page.getByTestId('marker-value-input-0').fill('16.2');
        await page.getByTestId('remove-marker-1').click();
        await expect(
          page.getByText('White Blood Cells (WBC)')
        ).not.toBeVisible();

        const searchInput = page.getByTestId('test-search-input');
        await searchInput.fill('Platelets');
        await page.getByTestId('autocomplete-item-cbc_platelets').click();
        await page.getByTestId('marker-value-input-1').fill('250');

        await page.getByTestId('notes-input').fill('Updated checkup note');
        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
      });

      await test.step('Verify updated report on Home', async () => {
        await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
        await expect(page.getByText('16.2')).toBeVisible();
        await expect(page.getByText('14.5')).not.toBeVisible();

        await expect(page.getByText('Platelets (PLT)')).toBeVisible();
        await expect(page.getByText('250')).toBeVisible();

        await expect(
          page.getByText('White Blood Cells (WBC)')
        ).not.toBeVisible();
        await expect(page.getByText('"Updated checkup note"')).toBeVisible();
      });
    }
  );

  test(
    'should preserve exact selected date without shifting back by a day across multiple edits/saves',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create report with specific date (2026-09-26)', async () => {
        await page.getByTestId('floating-add-button').click();
        await page.getByTestId('menu-add-lab-results').click();

        const datePicker = page.getByTestId('date-picker-button');
        const dateInput = datePicker.locator('input[type="date"]');
        await dateInput.fill('2026-09-26');

        await expect(datePicker).toContainText('Sep 26, 2026');
        await expect(dateInput).toHaveValue('2026-09-26');

        const searchInput = page.getByTestId('test-search-input');
        await searchInput.fill('Hemoglobin');
        await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
        await page.getByTestId('marker-value-input-0').fill('15.1');

        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Sep 26, 2026')).toBeVisible();
        await expect(page.getByText('Sep 25, 2026')).not.toBeVisible();
      });

      const editBtn = page.getByTestId(/^edit-report-button-/);

      await test.step('First edit & save preserves exact date', async () => {
        await editBtn.click();
        await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);

        const editDatePicker = page.getByTestId('date-picker-button');
        const editDateInput = editDatePicker.locator('input[type="date"]');
        await expect(editDatePicker).toContainText('Sep 26, 2026');
        await expect(editDateInput).toHaveValue('2026-09-26');

        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Sep 26, 2026')).toBeVisible();
        await expect(page.getByText('Sep 25, 2026')).not.toBeVisible();
      });

      await test.step('Second edit & save still preserves date without drift', async () => {
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
    }
  );
});
