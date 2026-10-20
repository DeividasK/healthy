import {
  test,
  takeSnapshot,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Settings - Visual Regression', () => {
  test('Times of day', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await page.goto('/settings');
    await page.getByTestId('settings-time-HS').waitFor();
    await takeSnapshot(page, 'Settings - Times of Day', testInfo);
  });
});
