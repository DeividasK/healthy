import {
  test,
  takeSnapshot,
  seedTestPatient,
  openRoute,
} from '@/src/features/testing/visualTest';

test.describe('Settings - Visual Regression', () => {
  test('Times of day', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await openRoute(page, '/settings');
    await page.getByTestId('settings-time-HS').waitFor();
    await takeSnapshot(page, 'Settings - Times of Day', testInfo);
  });
});
