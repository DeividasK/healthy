import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Condition View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('Condition View - Add New Form', async ({ page }, testInfo) => {
    await page.goto('/condition/add');
    await page.getByTestId('condition-title-input').waitFor();
    // The empty add form, dimmed under a menu that lists every optional field.
    await page.getByTestId('remove-verification-button').click();
    await page.getByTestId('remove-category-button').click();
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor({ state: 'visible' });
    await waitForMenuToggle(page, 'add-option-button', true);
    await takeSnapshot(page, 'Condition optional fields menu', testInfo);
  });
});
