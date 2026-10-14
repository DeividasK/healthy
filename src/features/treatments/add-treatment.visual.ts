import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Treatment - Visual Regression', () => {
  test('Empty form and optional fields menu', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    await page.goto('/treatment/add');
    await page.getByTestId('treatment-form-title').waitFor();
    await takeSnapshot(page, 'Treatment - Add Form Empty', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor();
    await takeSnapshot(page, 'Treatment - Optional Fields Menu', testInfo);
  });
});
