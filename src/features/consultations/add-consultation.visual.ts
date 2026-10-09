import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Consultation View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('Consultation View - Add New Form', async ({ page }, testInfo) => {
    await page.goto('/consultation/add');
    await page.getByTestId('consultation-title-input').waitFor();

    await takeSnapshot(page, 'Consultation View - Add New Form', testInfo);
  });
});
