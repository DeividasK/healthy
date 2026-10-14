import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestConsultation,
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
