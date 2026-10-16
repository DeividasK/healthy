import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestServiceRequest,
  getTestServiceRequest,
  evaluateBridge,
} from '@/src/features/testing/testStorage';

test.describe('Edit Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'should allow editing an existing Consultation from Condition view',
    { tag: ['@smoke'] },
    async ({ page }) => {
      let conditionId = '';
      let consultationId = '';

      await test.step('Seed condition with consultation', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Hypertension Monitoring',
        });
        conditionId = cond.id;

        const cons = await seedTestConsultation(page, {
          conditionIds: [conditionId],
          title: 'Initial Checkup',
          doctorName: 'Dr. Watson',
          date: '2026-10-01',
          notes: 'Preliminary assessment.',
        });
        consultationId = cons.id;
      });

      await test.step('Open the consultation view from Condition and edit it', async () => {
        await page.getByTestId(`condition-open-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        await page
          .getByTestId(`condition-consultation-item-${consultationId}`)
          .click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}$`)
        );
        await page.getByTestId('consultation-diagnosis-condition').click();
        await expect(
          page.locator('[data-testid="condition-title"]:visible')
        ).toHaveText('Hypertension Monitoring');
        await page.getByTestId('back-button').click();
        await page.getByTestId('edit-consultation-button').click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}\\/edit`)
        );
        await expect(page.getByText('Edit Consultation')).toBeVisible();

        const titleInput = page.getByTestId('consultation-title-input');
        await expect(titleInput).toHaveValue('Initial Checkup');

        const doctorInput = page.getByTestId('consultation-doctor-input');
        await expect(doctorInput).toHaveValue('Dr. Watson');

        await titleInput.fill('Follow-up Examination');
        await doctorInput.fill('Dr. John Watson');
        await page.getByTestId('save-button').click();
      });

      await test.step('Verify the consultation view reflects the update', async () => {
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}$`)
        );
        await expect(page.getByTestId('consultation-title')).toHaveText(
          'Follow-up Examination'
        );
        await expect(
          page.getByTestId('consultation-view').getByText('Dr. John Watson')
        ).toBeVisible();
      });
    }
  );

  test(
    'should delete a linked Consultation from its view page with confirmation modal',
    { tag: ['@critical'] },
    async ({ page }) => {
      let conditionId = '';
      let consultationId = '';

      await test.step('Seed condition with consultation', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Migraine Study',
        });
        conditionId = cond.id;

        const cons = await seedTestConsultation(page, {
          conditionIds: [conditionId],
          title: 'Consultation To Delete',
          doctorName: 'Dr. Strange',
          date: '2026-10-02',
        });
        consultationId = cons.id;
      });

      await test.step('Open the consultation view and test delete cancellation', async () => {
        await page.getByTestId(`condition-open-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        await page
          .getByTestId(`condition-consultation-item-${consultationId}`)
          .click();
        await expect(page).toHaveURL(
          new RegExp(`.*consultation\\/${consultationId}$`)
        );

        const deleteBtn = page.getByTestId('delete-consultation-button');
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();
        await expect(page.getByText('Delete Consultation')).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByTestId('consultation-title')).toHaveText(
          'Consultation To Delete'
        );
      });

      await test.step('Re-open modal, verify countdown, and confirm deletion', async () => {
        await page.clock.install();
        await page.getByTestId('delete-consultation-button').click();

        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirmBtn).toContainText('Delete (');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();
      });

      await test.step('Verify consultation removed from Condition view and its deletion recorded for sync', async () => {
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(
          page.getByText('Consultation To Delete')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('condition-consultations-section')
        ).toHaveCount(0);

        const deletions = await page.evaluate(async () => {
          const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
          await bridge.flushLocalChanges();
          return await bridge.querySql(
            "SELECT resource_id FROM sync_changes WHERE resource_type = 'Encounter' AND op = 'delete'"
          );
        });
        expect(deletions).toEqual([{ resource_id: consultationId }]);
      });
    }
  );

  test('edits and removes the service provider', async ({ page }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Dental check',
      serviceProviderName: 'Smile Clinic',
    });

    await page.goto(`/consultation/${consultation.id}/edit`);
    const input = page.getByTestId('consultation-service-provider-input');
    await expect(input).toHaveValue('Smile Clinic');
    await page.getByTestId('remove-service-provider-button').click();
    await expect(input).toHaveCount(0);
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    await page.goto(`/consultation/${consultation.id}`);
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

    await page.goto(`/consultation/${consultation.id}/edit`);
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

    await page.goto(`/consultation/${visit.id}/edit`);
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

    await page.goto(`/consultation/${visit.id}`);
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
    await page.goto(`/service-request/${echo.id}`);
    await expect(
      page.getByTestId(`linked-consultation-${referring.id}`)
    ).toBeVisible();

    // Removing the origin link clears the origin.
    await page.goto(`/consultation/${visit.id}/edit`);
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
