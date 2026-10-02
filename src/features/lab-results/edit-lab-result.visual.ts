import { test, expect, takeSnapshot } from '@chromatic-com/playwright';

test.use({
  viewport: { width: 360, height: 740 },
  colorScheme: 'light',
  disableAutoSnapshot: true,
});

const FIXED_DATE = new Date('2026-10-02T10:00:00Z');

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

test.describe('Edit Lab Result View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_DATE);
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

    await page.goto(`/lab-result/${editReportId}/edit`);

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
