import { test, takeSnapshot } from '@/src/features/testing/visualTest';

test.describe('Database In Use View - Visual Regression', () => {
  test('Database In Use View - Another Tab Open', async ({
    page,
  }, testInfo) => {
    const firstTab = await page.context().newPage();
    await firstTab.goto('/');
    await firstTab.getByTestId('patient-given-name-input').waitFor();

    await page.goto('/');
    await page.getByText('Healthy is already open in another tab').waitFor();

    await takeSnapshot(
      page,
      'Database In Use View - Another Tab Open',
      testInfo
    );
  });
});
