import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestConsultation,
  seedTestCondition,
  seedTestTreatment,
  getTestTreatment,
  getTestClinicalDocument,
  findTreatmentsSection,
} from '@/src/features/testing/testStorage';

test.describe('Edit Treatment links', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('links and unlinks consultations while keeping the origin', async ({
    page,
  }) => {
    const origin = await seedTestConsultation(page, { title: 'First visit' });
    const followUp = await seedTestConsultation(page, {
      title: 'Follow-up visit',
    });
    const treatment = await seedTestTreatment(page, {
      title: 'Amoxicillin 500mg',
      consultationId: origin.id,
    });

    await page.goto(`/treatment/${treatment.id}/edit`);
    await expect(
      page.getByTestId(`link-selected-consultation-${origin.id}`)
    ).toBeVisible();
    await page.getByTestId('link-consultation-search-input').click();
    await page
      .getByTestId(`link-consultation-autocomplete-item-${followUp.id}`)
      .click();
    await page.getByTestId('link-remove-consultation-button').click();
    await page.getByTestId('save-treatment-button').click();

    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Amoxicillin 500mg'
    );
    await expect(
      page.getByTestId(`linked-consultation-${followUp.id}`)
    ).toBeVisible();
    expect(
      findTreatmentsSection(await getTestClinicalDocument(page, followUp.id))
        .entry
    ).toEqual([{ reference: `MedicationRequest/${treatment.id}` }]);
    expect(
      findTreatmentsSection(await getTestClinicalDocument(page, origin.id))
    ).toBeUndefined();
    // Where the treatment originated is provenance and does not change
    expect((await getTestTreatment(page, treatment.id)).encounter).toEqual({
      reference: `Encounter/${origin.id}`,
    });
    await expect(
      page.getByTestId('treatment-origin-consultation')
    ).toBeVisible();
  });
});

test.describe('Edit Treatment add menu', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('offers no link options when there is nothing to link and disables + once all fields are shown', async ({
    page,
  }) => {
    const treatment = await seedTestTreatment(page, {
      title: 'Vitamin D',
      requesterName: 'Dr. Lee',
      dosageInstructions: 'Daily',
      reason: 'Low levels',
      notes: 'With food',
    });
    await page.goto(`/treatment/${treatment.id}/edit`);
    // No consultations or conditions exist, so nothing can be linked.
    await expect(page.getByTestId('add-option-button')).toBeDisabled();

    await seedTestConsultation(page, { title: 'Check-up' });
    await page.reload();
    await expect(page.getByTestId('add-option-button')).toBeEnabled();
    await page.getByTestId('add-option-button').click();
    await expect(page.getByTestId('menu-link-consultation')).toBeVisible();
    await expect(
      page.getByTestId('menu-add-treatment-reasonCondition')
    ).toHaveCount(0);
    await page.getByTestId('menu-link-consultation').click();
    await expect(page.getByTestId('add-option-button')).toBeDisabled();
  });
});

test('hides the link search once every consultation and condition is linked', async ({
  page,
}) => {
  await clearAppStorage(page);
  await seedTestPatient(page);
  const consultation = await seedTestConsultation(page, {
    title: 'Only visit',
  });
  const condition = await seedTestCondition(page, { title: 'Only condition' });
  const treatment = await seedTestTreatment(page, {
    title: 'Fully linked',
    consultationId: consultation.id,
    reasonConditionIds: [condition.id],
  });
  await page.goto(`/treatment/${treatment.id}/edit`);
  await expect(
    page.getByTestId(`link-selected-consultation-${consultation.id}`)
  ).toBeVisible();
  await expect(page.getByTestId('link-consultation-search-input')).toHaveCount(
    0
  );
  await expect(
    page.getByTestId('treatment-condition-search-input')
  ).toHaveCount(0);

  // Unlinking makes the search available again
  await page.getByTestId('link-remove-consultation-button').click();
  await expect(
    page.getByTestId('link-consultation-search-input')
  ).toBeVisible();
});
