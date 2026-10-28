import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  waitForMenuToggle,
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

    await page.goto(`/condition/${cond.id}/edit`);
    await page.getByTestId('condition-title-input').waitFor();
    // The seed sets no severity, so the edit form adds it from the + menu.
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').waitFor({ state: 'visible' });
    await page
      .getByTestId('form-add-menu')
      .getByText('Severity', { exact: true })
      .click();
    await waitForMenuToggle(page, 'add-option-button', false);
    await page.getByTestId('severity-option-moderate').click();

    await takeSnapshot(page, 'Condition View - Edit Existing Mode', testInfo);
  });
});
