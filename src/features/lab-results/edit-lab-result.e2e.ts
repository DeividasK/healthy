import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedTestServiceRequest,
  evaluateBridge as bridge,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('Edit Lab Results Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'should preserve exact selected date without shifting back by a day across multiple edits/saves',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create report with specific date (2026-09-26)', async () => {
        await page.getByTestId('start-lab-result').click();

        const datePicker = page.getByTestId('date-picker-button');
        const dateInput = datePicker.locator('input[type="date"]');
        await dateInput.fill('2026-09-26');

        await expect(datePicker).toContainText('Sep 26, 2026');
        await expect(dateInput).toHaveValue('2026-09-26');

        const searchInput = page.getByTestId('test-search-input');
        await searchInput.fill('Hemoglobin');
        await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
        await page.getByTestId('marker-value-input-0').fill('15.1');

        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await page.getByRole('button', { name: 'Open biomarkers' }).click();
        const row = page.getByTestId(/^lab-result-card-/);
        await expect(row).toContainText('Sep 26, 2026');
        await expect(row).not.toContainText('Sep 25, 2026');
      });

      const editBtn = page.getByTestId('edit-lab-result-button');
      const reportDate = page.getByTestId('lab-result-date');

      await test.step('First edit & save preserves exact date', async () => {
        await page.getByTestId(/^lab-result-card-/).click();
        await editBtn.click();
        await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);

        const editDatePicker = page.getByTestId('date-picker-button');
        const editDateInput = editDatePicker.locator('input[type="date"]');
        await expect(editDatePicker).toContainText('Sep 26, 2026');
        await expect(editDateInput).toHaveValue('2026-09-26');

        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/lab-result\/[^/]+$/);
        await expect(reportDate).toHaveText('Sep 26, 2026');
      });

      await test.step('Second edit & save still preserves date without drift', async () => {
        await editBtn.click();
        await expect(page).toHaveURL(/.*lab-result\/.*\/edit/);
        await expect(page.getByTestId('date-picker-button')).toContainText(
          'Sep 26, 2026'
        );
        await expect(
          page.getByTestId('date-picker-button').locator('input[type="date"]')
        ).toHaveValue('2026-09-26');

        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(/lab-result\/[^/]+$/);
        await expect(reportDate).toHaveText('Sep 26, 2026');
      });
    }
  );

  test('edits the service provider and keeps unexposed report elements', async ({
    page,
  }) => {
    const { report } = await seedTestReport(page, {
      serviceProviderName: 'City Laboratory',
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });
    const practitioner = { reference: 'Practitioner/p1', display: 'Dr. Lab' };
    await page.evaluate(
      async ([id, performer]) => {
        await (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
          `UPDATE diagnostic_reports SET fhir_json = json_set(fhir_json,
             '$.performer', json_insert(json_extract(fhir_json, '$.performer'), '$[#]', json(?)),
             '$.conclusion', 'Within range',
             '$.contained', json('[{"resourceType":"Observation","id":"stale"}]')) WHERE id = ?;`,
          [performer, id]
        );
      },
      [report.id, JSON.stringify(practitioner)]
    );

    await openRoute(page, `/lab-result/${report.id}/edit`);
    const input = page.getByTestId('lab-result-service-provider-input');
    await expect(input).toHaveValue('City Laboratory');
    await page.getByTestId('remove-service-provider-button').click();
    await expect(input).toHaveCount(0);
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);

    const stored = await page.evaluate(async () =>
      JSON.parse(
        (
          await (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
            'SELECT fhir_json FROM diagnostic_reports;'
          )
        )[0].fhir_json
      )
    );
    expect(stored.performer).toEqual([practitioner]);
    expect(stored.conclusion).toBe('Within range');
    // Observations live in their own table, never inside the report JSON.
    expect(stored.contained).toBeUndefined();
  });

  test('keeps an Organization performer it cannot name on unrelated edits', async ({
    page,
  }) => {
    const { report } = await seedTestReport(page, {
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });
    const performer = {
      type: 'Organization',
      identifier: { system: 'https://example.org/labs', value: 'LAB-1' },
    };
    await page.evaluate(
      async ([id, value]) => {
        await (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
          `UPDATE diagnostic_reports
             SET fhir_json = json_set(fhir_json, '$.performer', json(?))
           WHERE id = ?;`,
          [value, id]
        );
      },
      [report.id, JSON.stringify([performer])]
    );

    await openRoute(page, `/lab-result/${report.id}/edit`);
    await expect(page.getByTestId('marker-value-input-0')).toHaveValue('14.5');
    await expect(
      page.getByTestId('lab-result-service-provider-input')
    ).toHaveCount(0);
    await page.getByTestId('marker-value-input-0').fill('15.1');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);

    const stored = await page.evaluate(async () =>
      JSON.parse(
        (
          await (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
            'SELECT fhir_json FROM diagnostic_reports;'
          )
        )[0].fhir_json
      )
    );
    expect(stored.performer).toEqual([performer]);
  });

  test('links service requests from the edit form and keeps them on unrelated edits', async ({
    page,
  }) => {
    const request = await seedTestServiceRequest(page, {
      title: 'Blood count',
    });
    const { report } = await seedTestReport(page, {
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });
    const storedBasedOn = async () =>
      JSON.parse(
        (
          await bridge(
            page,
            (b, id) =>
              b.querySql(
                'SELECT fhir_json FROM diagnostic_reports WHERE id = ?;',
                [id]
              ),
            report.id
          )
        )[0].fhir_json
      ).basedOn;

    await openRoute(page, `/lab-result/${report.id}/edit`);
    await page.getByTestId('plus-menu-button').click();
    await page.getByTestId('menu-link-service-request').click();
    await page.getByTestId('link-service-request-search-input').click();
    await page
      .getByTestId(`link-service-request-autocomplete-item-${request.id}`)
      .click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    const linked = [
      { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
    ];
    expect(await storedBasedOn()).toEqual(linked);

    // Saving other changes keeps the link
    await openRoute(page, `/lab-result/${report.id}/edit`);
    await expect(
      page.getByTestId(`link-selected-service-request-${request.id}`)
    ).toBeVisible();
    await page.getByTestId('marker-value-input-0').fill('14.2');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    expect(await storedBasedOn()).toEqual(linked);

    await openRoute(page, `/lab-result/${report.id}/edit`);
    await page.getByTestId('remove-link-service-request-button').click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    expect(await storedBasedOn()).toBeUndefined();
  });
});
