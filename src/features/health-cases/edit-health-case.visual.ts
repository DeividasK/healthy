import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { seedHealthCase } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Edit Health Case View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Health Case View - Edit Existing Mode', async ({ page }, testInfo) => {
    await seedHealthCase(page, {
      id: 'case-visual-1',
      title: 'Left Knee Pain',
      status: 'active',
      startDate: '2026-10-02',
      description: 'Persistent ache after running on tarmac.',
    });

    await page.goto('/health-case/case-visual-1/edit');

    await expect(page.getByText('Edit Health Case')).toBeVisible();
    await expect(page.getByTestId('case-title-input')).toHaveValue(
      'Left Knee Pain'
    );
    await expect(page.getByTestId('case-description-input')).toHaveValue(
      'Persistent ache after running on tarmac.'
    );

    await takeSnapshot(page, 'Health Case View - Edit Existing Mode', testInfo);
  });
});
