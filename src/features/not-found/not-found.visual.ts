import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage } from '@/src/features/testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Not Found View - Visual Regression', () => {
  test('Not Found View - 404 Screen', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await page.goto('/some-non-existent-page');

    await expect(page.getByText("This screen doesn't exist.")).toBeVisible();
    await expect(page.getByText('Go to home screen!')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(page, 'Not Found View - 404 Screen', testInfo);
  });
});
