import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  getTestTreatment,
  openRoute,
  showAllTimelineSteps,
} from '@/src/features/testing/testStorage';

const getConsultation = (page: any, id: string) =>
  page.evaluate(
    (consultationId: string) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.getConsultation(consultationId),
    id
  );

test.describe('Edit Condition links', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('links consultations as reason or diagnosis and links treatments', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Migraine' });
    const visit = await seedTestConsultation(page, {
      title: 'Neurology visit',
    });
    const review = await seedTestConsultation(page, { title: 'GP review' });
    const treatment = await seedTestTreatment(page, {
      title: 'Sumatriptan 50mg',
      reason: 'Attacks',
    });

    await openRoute(page, `/condition/${condition.id}`);
    await page.getByTestId('edit-condition-button').click();
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-consultation').click();
    await expect(page.getByTestId('form-add-menu')).toHaveCount(0);
    for (const consultation of [visit, review]) {
      await page.getByTestId('link-consultation-search-input').click();
      await page
        .getByTestId(`link-consultation-autocomplete-item-${consultation.id}`)
        .click();
    }
    // Each link chooses how the consultation records the condition
    await expect(
      page.getByTestId(`link-consultation-role-${visit.id}`)
    ).toHaveValue('reason');
    await page
      .getByTestId(`link-consultation-role-${review.id}`)
      .selectOption('diagnosis');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-treatment').click();
    await page.getByTestId('link-treatment-search-input').click();
    await page
      .getByTestId(`link-treatment-autocomplete-item-${treatment.id}`)
      .click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    const reference = `Condition/${condition.id}`;
    const linkedVisit = await getConsultation(page, visit.id);
    expect(linkedVisit.reason[0].value[0].reference.reference).toBe(reference);
    const linkedReview = await getConsultation(page, review.id);
    expect(linkedReview.diagnosis[0].condition[0].reference.reference).toBe(
      reference
    );
    expect((await getTestTreatment(page, treatment.id)).reason).toEqual([
      { concept: { text: 'Attacks' } },
      { reference: { reference } },
    ]);
    await showAllTimelineSteps(page);
    await expect(
      page.getByTestId(`condition-timeline-item-consultation-${visit.id}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`condition-timeline-item-treatment-${treatment.id}`)
    ).toBeVisible();

    // Switching a role moves the link; unlinking keeps the treatment wording
    await page.getByTestId('edit-condition-button').click();
    await page
      .getByTestId(`link-consultation-role-${visit.id}`)
      .selectOption('diagnosis');
    await page
      .getByTestId(`link-selected-consultation-${review.id}`)
      .getByRole('button', { name: /^Remove consultation/ })
      .click();
    await page.getByTestId('link-remove-treatment-button').click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);

    const switched = await getConsultation(page, visit.id);
    expect(switched.reason).toBeUndefined();
    expect(switched.diagnosis[0].condition[0].reference.reference).toBe(
      reference
    );
    expect((await getConsultation(page, review.id)).diagnosis).toBeUndefined();
    expect((await getTestTreatment(page, treatment.id)).reason).toEqual([
      { concept: { text: 'Attacks' } },
    ]);
    await expect(
      page.getByTestId(`condition-timeline-item-consultation-${review.id}`)
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`condition-timeline-item-treatment-${treatment.id}`)
    ).toHaveCount(0);
  });
});
