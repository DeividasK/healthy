import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import { seedCondition } from '../testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Edit Condition View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Condition View - Edit Existing Mode', async ({ page }, testInfo) => {
    await seedCondition(page, {
      id: 'cond-visual-1',
      title: 'Left Knee Pain',
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      onsetDate: '2026-10-02',
      notes: 'Persistent ache after running on tarmac.',
    });

    await page.goto('/condition/cond-visual-1/edit');

    await expect(page.getByText('Edit Condition')).toBeVisible();
    await expect(page.getByTestId('condition-title-input')).toHaveValue(
      'Left Knee Pain'
    );
    await expect(page.getByTestId('condition-notes-input')).toHaveValue(
      'Persistent ache after running on tarmac.'
    );

    await takeSnapshot(page, 'Condition View - Edit Existing Mode', testInfo);
  });
});
