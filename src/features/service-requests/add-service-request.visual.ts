import {
  test,
  takeSnapshot,
  waitForMenuToggle,
  seedTestPatient,
  openRoute,
} from '@/src/features/testing/visualTest';

test.describe('Add Service Request - Visual Regression', () => {
  test('Empty form and optional fields menu', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await openRoute(page, '/service-request/add');
    await page.getByTestId('service-request-form-title').waitFor();
    await takeSnapshot(page, 'Service Request - Add Form Empty', testInfo);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor();
    await waitForMenuToggle(page, 'add-option-button', true);
    await takeSnapshot(
      page,
      'Service Request - Optional Fields Menu',
      testInfo
    );
  });
});
