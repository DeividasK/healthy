import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Planned Care - Visual Regression', () => {
  test('Empty form and optional fields menu', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await page.goto('/planned-care/add');
    await page.getByTestId('planned-care-form-title').waitFor();
    await takeSnapshot(page, 'Planned Care - Add Form Empty', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor();
    await waitForMenuToggle(page, 'add-option-button', true);
    await takeSnapshot(page, 'Planned Care - Optional Fields Menu', testInfo);
  });
});
