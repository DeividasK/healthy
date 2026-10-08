import { test, expect, takeSnapshot } from '@chromatic-com/playwright';
import {
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
} from '@/src/features/testing/testStorage';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

test.describe('Edit Condition View - Visual Regression', () => {
  test('Condition View - Edit Existing Mode', async ({ page }, testInfo) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    const cond = await seedTestCondition(page, {
      id: 'cond-visual-test',
      title: 'Left Knee Pain',
      status: 'active',
      notes: 'Persistent ache after running on tarmac.',
      onsetDate: '2026-10-02',
    });

    await page.goto(`/condition/${cond.id}/edit`);

    await expect(page.getByText('Edit Condition')).toBeVisible();
    await expect(page.getByTestId('condition-title-input')).toHaveValue(
      'Left Knee Pain'
    );
    await expect(page.getByTestId('condition-notes-input')).toHaveValue(
      'Persistent ache after running on tarmac.'
    );

    await page.clock.setFixedTime(FIXED_DATE);
    await takeSnapshot(page, 'Condition View - Edit Existing Mode', testInfo);
  });
});
