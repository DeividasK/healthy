import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Add Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test(
    'should allow creating a Condition with status, title, and optional fields via plus modal',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      await test.step('Navigate to Add Condition screen and audit a11y', async () => {
        await page.getByTestId('floating-add-button').click();
        await page.getByTestId('menu-add-condition').click();

        await expect(page).toHaveURL(/.*condition\/add/);
        await expect(page.getByText('New Condition')).toBeVisible();
        await checkA11y(page, { disableRules: ['color-contrast'] });
      });

      await test.step('Select status and enter condition title', async () => {
        const statusSelect = page.getByTestId('status-picker-select');
        await statusSelect.selectOption('active');

        const titleInput = page.getByTestId('condition-title-input');
        await titleInput.fill('Left Knee Pain');

        await expect(
          page.getByTestId('condition-notes-input')
        ).not.toBeVisible();
      });

      await test.step('Add optional notes via plus modal', async () => {
        const addOptionBtn = page.getByTestId('add-option-button');
        await expect(addOptionBtn).toBeVisible();
        await addOptionBtn.click();

        const addNotesOption = page.getByTestId('menu-add-notes');
        await expect(addNotesOption).toBeVisible();
        await addNotesOption.click();

        const notesInput = page.getByTestId('condition-notes-input');
        await expect(notesInput).toBeVisible();
        await notesInput.fill('Mild swelling after jogging 5km.');
      });

      await test.step('Save condition and verify card on Home', async () => {
        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Left Knee Pain')).toBeVisible();
        await expect(
          page.getByText('Mild swelling after jogging 5km.')
        ).toBeVisible();
        await expect(page.getByText('Active')).toBeVisible();

        const editBtn = page.getByTestId(/^edit-condition-button-/);
        const deleteBtn = page.getByTestId(/^delete-condition-button-/);
        await expect(editBtn).toBeVisible();
        await expect(deleteBtn).toBeVisible();
      });
    }
  );
});
