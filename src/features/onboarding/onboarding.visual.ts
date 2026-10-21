import { test, takeSnapshot } from '@/src/features/testing/visualTest';

test.describe('Onboarding - Visual Regression', () => {
  test('Onboarding - Welcome', async ({ page }, testInfo) => {
    await page.goto('/welcome');
    await page.getByTestId('welcome-get-started').waitFor();
    await takeSnapshot(page, 'Onboarding - Welcome', testInfo);
  });

  test('Onboarding - Name', async ({ page }, testInfo) => {
    await page.goto('/welcome/name');
    await page.getByTestId('welcome-name-input').waitFor();
    await takeSnapshot(page, 'Onboarding - Name', testInfo);

    await page.getByTestId('welcome-name-input').fill('Jane');
    await takeSnapshot(page, 'Onboarding - Name filled', testInfo);
  });
});
