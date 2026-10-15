import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Add Treatment - Visual Regression', () => {
  test('Empty form and optional fields menu', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await page.goto('/treatment/add');
    await page.getByTestId('treatment-form-title').waitFor();
    await takeSnapshot(page, 'Treatment - Add Form Empty', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor();
    await waitForMenuToggle(page, 'add-option-button', true);
    await takeSnapshot(page, 'Treatment - Optional Fields Menu', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor({ state: 'hidden' });
    await waitForMenuToggle(page, 'add-option-button', false);
    await page.getByTestId('treatment-title-input').focus();
    await page.keyboard.press('Tab');
    await takeSnapshot(page, 'Treatment - Select Keyboard Focus', testInfo, {
      keepFocus: true,
    });
  });
});
