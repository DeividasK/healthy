import { test, expect, takeSnapshot } from '@chromatic-com/playwright';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

async function clearStorage(page: any) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.describe('Not Found View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Not Found View - 404 Screen', async ({ page }, testInfo) => {
    await clearStorage(page);
    await page.goto('/some-non-existent-page');

    await expect(page.getByText("This screen doesn't exist.")).toBeVisible();
    await expect(page.getByText('Go to home screen!')).toBeVisible();

    await takeSnapshot(page, 'Not Found View - 404 Screen', testInfo);
  });
});
