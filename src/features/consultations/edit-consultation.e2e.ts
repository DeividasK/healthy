import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  seedTestServiceRequest,
  getTestServiceRequest,
  evaluateBridge,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('Edit Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('edits and removes the service provider', async ({ page }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Dental check',
      serviceProviderName: 'Smile Clinic',
    });

    await openRoute(page, `/consultation/${consultation.id}/edit`);
    const input = page.getByTestId('consultation-service-provider-input');
    await expect(input).toHaveValue('Smile Clinic');
    await page.getByTestId('remove-service-provider-button').click();
    await expect(input).toHaveCount(0);
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    await openRoute(page, `/consultation/${consultation.id}`);
    await expect(page.getByTestId('consultation-title')).toBeVisible();
    await expect(page.getByTestId('consultation-service-provider')).toHaveCount(
      0
    );

    const stored = await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      return {
        encounter: JSON.parse(
          (await bridge.querySql('SELECT fhir_json FROM consultations;'))[0]
            .fhir_json
        ),
        organizations: await bridge.querySql('SELECT name FROM organizations;'),
      };
    });
    expect(stored.encounter.serviceProvider).toBeUndefined();
    // The Organization stays available as a suggestion.
    expect(stored.organizations).toEqual([{ name: 'Smile Clinic' }]);
  });

  test('keeps a service provider reference that has no display name', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Dental check',
      serviceProviderName: 'Smile Clinic',
    });
    const encounter = async () =>
      JSON.parse(
        (
          await page.evaluate(() =>
            (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
              'SELECT fhir_json FROM consultations;'
            )
          )
        )[0].fhir_json
      );
    // Imported or synced references may carry only `reference`.
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        "UPDATE consultations SET fhir_json = json_remove(fhir_json, '$.serviceProvider.display');"
      )
    );
    const { reference } = (await encounter()).serviceProvider;

    await openRoute(page, `/consultation/${consultation.id}/edit`);
    // The name comes from the stored Organization.
    await expect(
      page.getByTestId('consultation-service-provider-input')
    ).toHaveValue('Smile Clinic');
    await page.getByTestId('consultation-title-input').fill('Dental review');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);

    expect((await encounter()).serviceProvider).toEqual({
      reference,
      type: 'Organization',
      display: 'Smile Clinic',
    });
  });

  test('records a service request as based on, or moves its single origin here', async ({
    page,
  }) => {
    const referring = await seedTestConsultation(page, {
      title: 'GP visit',
    });
    const visit = await seedTestConsultation(page, {
      title: 'Cardiology appointment',
    });
    const referral = await seedTestServiceRequest(page, {
      title: 'Cardiology referral',
      consultationId: referring.id,
    });
    const echo = await seedTestServiceRequest(page, {
      title: 'Echocardiogram',
      consultationId: referring.id,
    });

    await openRoute(page, `/consultation/${visit.id}/edit`);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-service-request').click();
    for (const request of [referral, echo]) {
      await page.getByTestId('link-service-request-search-input').click();
      await page
        .getByTestId(`link-service-request-autocomplete-item-${request.id}`)
        .click();
    }
    await page
      .getByTestId(`link-service-request-role-${referral.id}`)
      .selectOption('basedOn');
    await page
      .getByTestId(`link-service-request-role-${echo.id}`)
      .selectOption('origin');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/edit$/);

    await openRoute(page, `/consultation/${visit.id}`);
    await expect(
      page.getByTestId(`consultation-based-on-${referral.id}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`consultation-service-request-${echo.id}`)
    ).toBeVisible();
    const stored = await evaluateBridge(
      page,
      (b, id) => b.getConsultation(id),
      visit.id
    );
    expect(stored.basedOn).toEqual([
      { reference: `ServiceRequest/${referral.id}`, type: 'ServiceRequest' },
    ]);
    // The origin moved; the earlier consultation still lists the request.
    expect((await getTestServiceRequest(page, echo.id)).encounter).toEqual({
      reference: `Encounter/${visit.id}`,
    });
    expect((await getTestServiceRequest(page, referral.id)).encounter).toEqual({
      reference: `Encounter/${referring.id}`,
    });
    await openRoute(page, `/service-request/${echo.id}`);
    await expect(
      page.getByTestId(`linked-consultation-${referring.id}`)
    ).toBeVisible();

    // Removing the origin link clears the origin.
    await openRoute(page, `/consultation/${visit.id}/edit`);
    await page
      .getByRole('button', { name: 'Remove service-request Echocardiogram' })
      .click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/edit$/);
    expect(
      (await getTestServiceRequest(page, echo.id)).encounter
    ).toBeUndefined();
  });
});
