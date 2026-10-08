import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { clearAppStorage, createPatientViaUI } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Add Condition View - Visual Regression', () => {
  test('Condition View - Add New Form', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
    await page.goto('/condition/add');

    await expect(page.getByText('New Condition')).toBeVisible();
    await expect(page.getByTestId('condition-title-input')).toBeVisible();

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(page, 'Condition View - Add New Form', testInfo);
  });
});
