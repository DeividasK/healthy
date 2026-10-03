import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Add Health Case View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Health Case View - Add New Form', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await page.goto('/health-case/add');

    await expect(page.getByText('New Health Case')).toBeVisible();
    await expect(page.getByTestId('case-title-input')).toBeVisible();

    await takeSnapshot(page, 'Health Case View - Add New Form', testInfo);
  });
});
