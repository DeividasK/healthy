import {
  test,
  takeSnapshot,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Condition View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('Condition View - Add New Form', async ({ page }, testInfo) => {
    await page.goto('/condition/add');
    await page.getByTestId('condition-title-input').waitFor();

    await takeSnapshot(page, 'Condition View - Add New Form', testInfo);
    await page
      .getByTestId('verification-picker-button')
      .selectOption('confirmed');
    await page
      .getByTestId('condition-category-input')
      .selectOption('Temporary');
    await takeSnapshot(page, 'Condition native dropdowns', testInfo);
    await page.getByTestId('remove-verification-button').click();
    await page.getByTestId('remove-category-button').click();
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor({ state: 'visible' });
    await takeSnapshot(page, 'Condition optional fields menu', testInfo);
  });
});
