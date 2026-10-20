import {
  test,
  expect,
  seedTestPatient,
  seedTestServiceRequest,
  evaluateBridge as bridge,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('View Service Request', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('records a consultation based on it and lists both ways', async ({
    page,
  }) => {
    const instructions = Array.from(
      { length: 8 },
      (_, i) => `${i + 1}. Step ${i + 1} of the preparation, exactly as given.`
    ).join('\n');
    const request = await seedTestServiceRequest(page, {
      title: 'Dermatology referral',
      category: '3457005',
      instructions,
    });
    await openRoute(page, `/service-request/${request.id}`);
    // Long multi-line instructions are shown exactly as given.
    await expect(page.getByTestId('service-request-instructions')).toHaveText(
      instructions
    );
    await page.getByTestId('service-request-add-button').click();
    await page.getByTestId('menu-add-consultation').click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/add\\?basedOnId=${request.id}`)
    );
    await page
      .getByTestId('consultation-title-input')
      .fill('Dermatology appointment');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/consultation\/add/);

    const [consultation] = await bridge(page, (b) =>
      b.querySql(
        "SELECT id, fhir_json FROM consultations WHERE title = 'Dermatology appointment';"
      )
    );
    expect(JSON.parse(consultation.fhir_json).basedOn).toEqual([
      { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
    ]);

    await openRoute(page, `/consultation/${consultation.id}`);
    await page
      .getByTestId('consultation-based-on')
      .getByText('Dermatology referral')
      .click();
    await expect(page).toHaveURL(new RegExp(`service-request/${request.id}$`));
    await expect(
      page.getByTestId(`based-on-consultation-${consultation.id}`)
    ).toBeVisible();
  });
});
