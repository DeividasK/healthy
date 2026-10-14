import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
  getTestTreatment,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Edit Treatment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('edits fields, regenerates the narrative and associates multiple conditions', async ({
    page,
  }) => {
    const first = await seedTestCondition(page, { title: 'Hypertension' });
    const second = await seedTestCondition(page, { title: 'Kidney disease' });
    const treatment = await seedTestTreatment(page, {
      title: 'Amoxicillin 500mg',
      intent: 'order',
      status: 'active',
      reason: 'Blood pressure',
      reasonConditionIds: [first.id],
    });
    const before = await getTestTreatment(page, treatment.id);
    expect(before.text.div).toContain('Amoxicillin 500mg');

    await page.goto(`/treatment/${treatment.id}`);
    await page.getByTestId('edit-treatment-button').click();
    await expect(page).toHaveURL(/.*treatment\/[a-zA-Z0-9_-]+\/edit$/);
    await expect(
      page.getByTestId(`treatment-selected-condition-${first.id}`)
    ).toBeVisible();

    await page.getByTestId('treatment-title-input').fill('Lisinopril 10mg');
    await page.getByTestId('treatment-status-select').selectOption('completed');
    await page.getByTestId('treatment-condition-search-input').click();
    await page
      .getByTestId(`treatment-condition-autocomplete-item-${second.id}`)
      .click();
    await checkA11y(page, { include: '[data-testid="treatment-form"]' });
    await page.getByTestId('save-treatment-button').click();

    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Lisinopril 10mg'
    );
    await expect(
      page.getByTestId('treatment-view').getByText('Completed')
    ).toBeVisible();
    const section = page.getByTestId('treatment-reason-conditions-section');
    await expect(section).toContainText('Hypertension');
    await expect(section).toContainText('Kidney disease');

    const edited = await getTestTreatment(page, treatment.id);
    expect(edited.text.div).toContain('Lisinopril 10mg');
    expect(edited.text.div).not.toContain('Amoxicillin');
    expect(
      edited.reason.map((reason: any) => reason.reference?.reference)
    ).toEqual([undefined, `Condition/${first.id}`, `Condition/${second.id}`]);

    // Removing one condition keeps the other
    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('treatment-remove-condition-button').click();
    await page.getByTestId('save-treatment-button').click();
    await expect(section).not.toContainText('Hypertension');
    await expect(section).toContainText('Kidney disease');

    // Removing the field clears only the links; the wording stays
    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('remove-treatment-reasonCondition-button').click();
    await page.getByTestId('save-treatment-button').click();
    await expect(section).toHaveCount(0);
    const cleared = await getTestTreatment(page, treatment.id);
    expect(cleared.reason).toEqual([{ concept: { text: 'Blood pressure' } }]);
  });

  test('labels uncommon intent and status codes instead of hiding them', async ({
    page,
  }) => {
    const treatment = await seedTestTreatment(page, {
      title: 'Imported treatment',
      intent: 'proposal',
      status: 'on-hold',
    });
    await page.goto(`/treatment/${treatment.id}`);
    await expect(page.getByTestId('treatment-intent')).toHaveText('Proposal');
    await expect(
      page.getByTestId('treatment-view').getByText('On Hold')
    ).toBeVisible();

    await page.getByTestId('edit-treatment-button').click();
    await expect(page.getByTestId('treatment-intent-select')).toHaveValue(
      'proposal'
    );
    await expect(
      page.getByTestId('treatment-intent-select').locator('option:checked')
    ).toHaveText('Proposal');
  });
});
