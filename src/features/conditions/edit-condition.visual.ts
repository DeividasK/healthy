import {
  test,
  takeSnapshot,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
} from '@/src/features/testing/visualTest';

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
    await page.getByTestId('condition-title-input').waitFor();

    await takeSnapshot(page, 'Condition View - Edit Existing Mode', testInfo);
  });
});
