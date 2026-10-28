import {
  test,
  takeSnapshot,
  seedTestPatient,
} from '@/src/features/testing/visualTest';

test.describe('Settings - Visual Regression', () => {
  test('Folded sections', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    await page.goto('/settings');
    await page.getByTestId('settings-times-of-day-toggle').waitFor();
    await takeSnapshot(page, 'Settings - Folded sections', testInfo);
  });

  for (const [layout, viewport] of [
    ['', undefined],
    [' - Desktop', { width: 1280, height: 800 }],
  ] as const)
    test(`Times of day${layout}`, async ({ page }, testInfo) => {
      if (viewport) await page.setViewportSize(viewport);
      await seedTestPatient(page);
      await page.goto('/settings');
      await page.getByTestId('settings-times-of-day-toggle').click();
      await page.getByTestId('settings-time-MORN').waitFor();
      await takeSnapshot(page, `Settings - Times of day${layout}`, testInfo);
    });
});
