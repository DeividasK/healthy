import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Condition View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('Condition View - Add New Form', async ({ page }, testInfo) => {
    await page.goto('/condition/add');
    await page.getByTestId('condition-title-input').waitFor();

    await takeSnapshot(page, 'Condition View - Add New Form', testInfo);
    await page.getByTestId('verification-picker-button').click();
    await takeSnapshot(page, 'Condition verification options', testInfo);
    await page.getByTestId('verification-option-confirmed').click();
    await page.getByTestId('condition-category-input').click();
    await takeSnapshot(page, 'Condition category options', testInfo);
    await page.getByTestId('category-option-encounter-diagnosis').click();
    await page.getByTestId('remove-verification-button').click();
    await page.getByTestId('remove-category-button').click();
    await page.getByTestId('add-option-button').click();
    await takeSnapshot(page, 'Condition optional fields menu', testInfo);
  });
});
