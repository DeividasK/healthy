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
        // Audit once Home's closing menu has faded out completely
        await expect(page.getByTestId('floating-add-menu')).toHaveCount(0);
        await checkA11y(page);
        const titleBounds = (await page
          .getByTestId('condition-title-input')
          .boundingBox())!;
        for (const id of [
          'verification-picker-button',
          'condition-category-input',
        ]) {
          const field = page.getByTestId(id);
          await expect(field).toHaveRole('combobox');
          const bounds = (await field.boundingBox())!;
          const caret = (await page.getByTestId(`${id}-caret`).boundingBox())!;
          expect(bounds.x).toBeCloseTo(titleBounds.x);
          expect(bounds.width).toBeCloseTo(titleBounds.width);
          expect(caret.y + caret.height / 2).toBeCloseTo(
            bounds.y + bounds.height / 2
          );
          expect(bounds.x + bounds.width - caret.x - caret.width).toBeCloseTo(
            14
          );
        }
      });

      await test.step('Select status and enter condition title', async () => {
        const statusSelect = page.getByTestId('status-picker-select');
        await statusSelect.selectOption('active');
        await page
          .getByTestId('verification-picker-button')
          .selectOption('confirmed');

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

        const conditionCard = page.getByTestId(/^condition-card-/);
        await expect(conditionCard).toBeVisible();
        await expect(page.getByTestId(/^edit-condition-button-/)).toHaveCount(
          0
        );
        await expect(page.getByTestId(/^delete-condition-button-/)).toHaveCount(
          0
        );
      });
    }
  );
});
