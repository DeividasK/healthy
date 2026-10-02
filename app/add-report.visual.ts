import { test, expect, takeSnapshot } from '@chromatic-com/playwright';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

// Helper to clear local storage before tests
async function clearStorage(page: any) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// Helper to seed reports directly into web AsyncStorage (localStorage)
async function seedReports(page: any, reports: any[]) {
  await page.goto('/');
  await page.evaluate((reportsList: any[]) => {
    localStorage.clear();
    sessionStorage.clear();

    const reportsObj: Record<string, any> = {};
    const obsObj: Record<string, any[]> = {};

    for (const r of reportsList) {
      reportsObj[r.id] = {
        id: r.id,
        effective_date: r.effectiveDate,
        status: 'final',
        notes: r.notes || null,
        fhir_json: JSON.stringify({
          resourceType: 'DiagnosticReport',
          id: r.id,
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '58410-2',
                display: 'Complete blood count (CBC) panel',
              },
            ],
            text: 'Complete Blood Count',
          },
          effectiveDateTime: r.effectiveDateTime || r.effectiveDate,
          note: r.notes ? [{ text: r.notes }] : undefined,
        }),
        created_at: '2026-10-02T10:00:00.000Z',
        updated_at: '2026-10-02T10:00:00.000Z',
      };

      obsObj[r.id] = r.observations.map((obs: any, idx: number) => {
        const obsId = `obs-${r.id}-${idx}`;
        const fhirObs = {
          resourceType: 'Observation',
          id: obsId,
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: obs.loinc,
                display: obs.name,
              },
            ],
            text: obs.name,
          },
          valueQuantity: {
            value: obs.value,
            unit: obs.unit,
            system: 'http://unitsofmeasure.org',
            code: obs.unit,
          },
          interpretation: obs.interpretationCode
            ? [
                {
                  coding: [
                    {
                      system:
                        'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                      code: obs.interpretationCode,
                      display:
                        obs.interpretationCode === 'N'
                          ? 'Normal'
                          : obs.interpretationCode === 'L'
                            ? 'Low'
                            : 'High',
                    },
                  ],
                },
              ]
            : undefined,
        };

        return {
          id: obsId,
          report_id: r.id,
          loinc_code: obs.loinc,
          name: obs.name,
          value: obs.value,
          unit: obs.unit,
          fhir_json: JSON.stringify(fhirObs),
          created_at: '2026-10-02T10:00:00.000Z',
        };
      });
    }

    localStorage.setItem(
      '@healthy_diagnostic_reports_v1',
      JSON.stringify(reportsObj)
    );
    localStorage.setItem('@healthy_observations_v1', JSON.stringify(obsObj));
  }, reports);
}

test.describe('Add Report View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
  });

  test('Add Report View - Initial Clean Form', async ({ page }, testInfo) => {
    await clearStorage(page);
    await page.goto('/add-report');

    await expect(page.getByText('Add Lab Results')).toBeVisible();
    await expect(page.getByTestId('date-picker-button')).toBeVisible();
    await expect(page.getByTestId('test-search-input')).toBeVisible();

    await takeSnapshot(page, 'Add Report View - Initial Clean Form', testInfo);
  });

  test('Add Report View - Autocomplete Dropdown Open', async ({
    page,
  }, testInfo) => {
    await clearStorage(page);
    await page.goto('/add-report');

    const searchInput = page.getByTestId('test-search-input');
    await searchInput.click();

    const autocompleteList = page.getByTestId('autocomplete-list');
    await expect(autocompleteList).toBeVisible();
    await expect(
      page.getByTestId('autocomplete-item-cbc_hemoglobin')
    ).toBeVisible();

    await takeSnapshot(
      page,
      'Add Report View - Autocomplete Dropdown Open',
      testInfo
    );
  });

  test('Add Report View - Populated Biomarkers', async ({ page }, testInfo) => {
    await clearStorage(page);
    await page.goto('/add-report');

    const searchInput = page.getByTestId('test-search-input');

    // Add Hemoglobin
    await searchInput.fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('14.2');

    // Add Platelets
    await searchInput.fill('Platelets');
    await page.getByTestId('autocomplete-item-cbc_platelets').click();
    await page.getByTestId('marker-value-input-1').fill('260');

    await expect(page.getByTestId('marker-card-0')).toBeVisible();
    await expect(page.getByTestId('marker-card-1')).toBeVisible();

    await takeSnapshot(
      page,
      'Add Report View - Populated Biomarkers',
      testInfo
    );
  });

  test('Add Report View - Expanded Time and Notes', async ({
    page,
  }, testInfo) => {
    await clearStorage(page);
    await page.goto('/add-report');

    // Add a marker
    const searchInput = page.getByTestId('test-search-input');
    await searchInput.fill('WBC');
    await page.getByTestId('autocomplete-item-cbc_wbc').click();
    await page.getByTestId('marker-value-input-0').fill('5.4');

    // Open plus menu and add Time
    const plusBtn = page.getByTestId('plus-menu-button');
    await plusBtn.click();
    await page.getByTestId('menu-add-time').click();

    // Set custom time
    const timeInput = page
      .getByTestId('time-picker-button')
      .locator('input[type="time"]');
    await timeInput.fill('08:45');

    // Open plus menu and add Notes
    await plusBtn.click();
    await page.getByTestId('menu-add-notes').click();
    await page
      .getByTestId('notes-input')
      .fill('Fasting morning blood sample taken at clinic');

    await expect(page.getByTestId('time-picker-button')).toContainText('08:45');
    await expect(page.getByTestId('notes-input')).toBeVisible();

    await takeSnapshot(
      page,
      'Add Report View - Expanded Time and Notes',
      testInfo
    );
  });

  test('Add Report View - Edit Existing Mode', async ({ page }, testInfo) => {
    const editReportId = 'report-to-edit';
    await seedReports(page, [
      {
        id: editReportId,
        effectiveDate: '2026-09-26',
        effectiveDateTime: '2026-09-26T07:15:00.000Z',
        notes: 'Initial checkup notes for editing',
        observations: [
          {
            name: 'Hemoglobin (Hgb)',
            loinc: '718-7',
            value: 13.8,
            unit: 'g/dL',
            interpretationCode: 'N',
          },
          {
            name: 'Platelets (PLT)',
            loinc: '777-3',
            value: 210,
            unit: '10*3/uL',
            interpretationCode: 'N',
          },
        ],
      },
    ]);

    await page.goto(`/add-report?id=${editReportId}`);

    await expect(page.getByText('Edit Lab Results')).toBeVisible();
    await expect(page.getByTestId('marker-card-0')).toContainText(
      'Hemoglobin (Hgb)'
    );
    await expect(page.getByTestId('marker-value-input-0')).toHaveValue('13.8');
    await expect(page.getByTestId('notes-input')).toHaveValue(
      'Initial checkup notes for editing'
    );

    await takeSnapshot(page, 'Add Report View - Edit Existing Mode', testInfo);
  });
});
