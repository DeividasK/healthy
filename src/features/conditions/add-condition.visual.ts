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
  });
});
