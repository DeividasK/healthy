import {
  test,
  takeSnapshot,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Offline Indicator - Visual Regression', () => {
  test('Header - Offline', async ({ page, context }, testInfo) => {
    await seedTestPatient(page);
    await page.getByText('Nothing to show yet', { exact: true }).waitFor();

    await context.setOffline(true);
    await page.getByTestId('offline-header-indicator').waitFor();

    await takeSnapshot(page, 'Header - Offline', testInfo);
  });
});
