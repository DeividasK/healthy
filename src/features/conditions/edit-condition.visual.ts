import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  openRoute,
} from '@/src/features/testing/visualTest';

test.describe('Edit Condition View - Visual Regression', () => {
  test('Condition View - Edit Existing Mode', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const cond = await seedTestCondition(page, {
      id: 'cond-visual-test',
      title: 'Left Knee Pain',
      status: 'active',
      notes: 'Persistent ache after running on tarmac.',
      onsetDate: '2026-10-02',
    });

    await openRoute(page, `/condition/${cond.id}/edit`);
    await page.getByTestId('condition-title-input').waitFor();

    await takeSnapshot(page, 'Condition View - Edit Existing Mode', testInfo);
  });
});
