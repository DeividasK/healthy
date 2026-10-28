import {
  test,
  expect,
  useSingleColumnLayout,
  expandBiomarkerGroups,
} from '@/src/features/testing/testStorage';
import {
  seedTestPatient,
  seedTestReport,
  openRoute,
  reopenRoute,
  evaluateBridge,
} from '@/src/features/testing/testSeed';
import type { Page } from '@playwright/test';

const getProfileSettings = (page: Page) =>
  evaluateBridge(page, (bridge) => bridge.getProfileSettings());

// Reached from the single-column summary; the desktop list and detail is
// tested in labs-summary.e2e.ts.
test.beforeEach(async ({ page }) => useSingleColumnLayout(page));

test.describe('Biomarker detail', () => {
  test('rejects seed biomarkers and units outside the biomarker catalog', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await expect(
      seedTestReport(page, {
        id: 'invalid-unit',
        biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/l-typo' }],
      })
    ).rejects.toThrow('Unknown unit "g/l-typo" for Hemoglobin (Hgb)');
    const record = await seedTestReport(page, {
      biomarkers: [
        { name: 'Hemoglobin', value: 150, unit: 'g/L' },
        { name: 'Red Blood Cells', value: 4.5 },
      ],
    });
    expect(record.observations[0].valueQuantity.code).toBe('g/L');
    // Results seeded without a printed range carry none.
    expect(record.observations[0].referenceRange).toBeUndefined();
    expect(record.observations[1].valueQuantity.code).toBe('10*6/uL');
    await expect(
      seedTestReport(page, {
        biomarkers: [{ name: 'Custom Marker', value: 42, unit: 'custom-unit' }],
      })
    ).rejects.toThrow('is not in the biomarker catalog');
    const rejectedReports = await page.evaluate(async () =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM diagnostic_reports WHERE id = ?',
        ['invalid-unit']
      )
    );
    expect(rejectedReports).toHaveLength(0);
  });

  test('uses matching reference units and normalizes mixed-unit history', async ({
    page,
  }) => {
    await seedTestPatient(page, { gender: 'male', birthDate: '1990-01-01' });
    await seedTestReport(page, {
      date: '2026-09-01',
      biomarkers: [
        {
          name: 'Hemoglobin',
          value: 14.5,
          unit: 'g/dL',
          referenceLow: 13.2,
          referenceHigh: 16.6,
        },
      ],
    });
    {
      const result = { date: '2026-10-01', value: '150', unit: 'g/L' };
      await openRoute(page, '/lab-result/add');
      await page.getByTestId('test-search-input').fill('Hemoglobin');
      await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
      await page.getByTestId('marker-value-input-0').fill(result.value);
      await page
        .getByTestId('unit-picker-button-0')
        .locator('select')
        .selectOption(result.unit);
      await page
        .getByTestId('date-picker-button')
        .locator('input')
        .fill(result.date);
      await page.getByTestId('save-button').click();
      await expect(page).toHaveURL(/\/$/);
    }

    const latestObservation = await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      const rows = await bridge.querySql(
        'SELECT id, fhir_json FROM observations'
      );
      const row = rows.find(
        (item: { fhir_json: string }) =>
          JSON.parse(item.fhir_json).valueQuantity.code === 'g/L'
      );
      return JSON.parse(row.fhir_json);
    });
    expect(latestObservation.referenceRange).toBeUndefined();
    expect(latestObservation.interpretation).toBeUndefined();
    await expect(
      page.getByTestId('labs-summary-grid-cell-718-7')
    ).toHaveAccessibleName('Hemoglobin (Hgb): In range');

    await openRoute(page, '/biomarker/718-7');
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('150');
    await expect(page.getByTestId('biomarker-latest-unit')).toHaveText('g/L');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'In range'
    );
    await expect(page.getByTestId('biomarker-loinc')).toHaveText('718-7');
    // The earlier report's range still applies, in the result's unit.
    const limits = page.getByTestId('biomarker-latest-range-limit');
    await expect(limits).toHaveText(['132', '166']);
    await expect(page.getByTestId('biomarker-range-list')).toContainText(
      '132–166 g/L'
    );
    const chart = page.getByTestId('biomarker-chart');
    await expect(chart.getByText('132', { exact: true })).toBeVisible();
    await expect(chart.getByText('166', { exact: true })).toBeVisible();
    const history = page.getByTestId('biomarker-history-list');
    // Every result is listed in the unit shown above.
    await expect(history.getByText('145', { exact: true })).toBeVisible();
    await expect(history.getByText('g/dL', { exact: true })).toHaveCount(0);
    await expect(
      history.locator('[data-testid^="biomarker-history-range-"]')
    ).toHaveCount(2);
    // The older result is plotted in the latest result's unit, labelled at its point.
    await expect(chart.getByText('145', { exact: true })).toBeVisible();
    await expect(page.getByTestId('biomarker-point-0')).toHaveAccessibleName(
      'Sep 1, 2026: 145 g/L'
    );
    await expect(
      page.getByTestId('learn-toggle-about-this-biomarker')
    ).toBeVisible();
    await expect(
      page.getByTestId('learn-toggle-what-it-may-affect')
    ).toHaveCount(0);
    await expect(
      page.getByTestId('learn-toggle-what-may-be-related-to-a-change')
    ).toHaveCount(0);

    // A laboratory's own bounds take priority and can use a different unit.
    await page.evaluate(async (id) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      const [row] = await bridge.querySql(
        'SELECT fhir_json FROM observations WHERE id = ?',
        [id]
      );
      const observation = JSON.parse(row.fhir_json);
      observation.referenceRange = [
        {
          low: {
            value: 14,
            unit: 'g/dL',
            code: 'g/dL',
            system: 'http://unitsofmeasure.org',
          },
          high: {
            value: 14.9,
            unit: 'g/dL',
            code: 'g/dL',
            system: 'http://unitsofmeasure.org',
          },
        },
      ];
      await bridge.executeSql(
        'UPDATE observations SET fhir_json = ? WHERE id = ?',
        [JSON.stringify(observation), id]
      );
    }, latestObservation.id);
    // Reload: raw SQL emits no change event for the mounted Home to pick up.
    await page.goto('/');
    await expect(
      page.getByTestId('labs-summary-grid-cell-718-7')
    ).toHaveAccessibleName('Hemoglobin (Hgb): Out of range');
    await openRoute(page, '/biomarker/718-7');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'Out of range'
    );
    await expect(chart.getByText('140', { exact: true })).toBeVisible();
    await expect(chart.getByText('149', { exact: true })).toBeVisible();
    await expect(limits).toHaveText(['140', '149']);

    // Unsupported stored measurements are excluded from history and trends.
    await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      const rows = await bridge.querySql(
        'SELECT id, fhir_json FROM observations'
      );
      const row = rows.find(
        (item: { fhir_json: string }) =>
          JSON.parse(item.fhir_json).valueQuantity.code === 'g/dL'
      );
      const observation = JSON.parse(row.fhir_json);
      observation.valueQuantity.unit = 'unknown-unit';
      observation.valueQuantity.code = 'unknown-unit';
      await bridge.executeSql(
        'UPDATE observations SET fhir_json = ?, unit = ? WHERE id = ?',
        [JSON.stringify(observation), 'unknown-unit', row.id]
      );
    });
    await reopenRoute(page);
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('150');
    await expect(
      history.getByText('unknown-unit', { exact: true })
    ).toHaveCount(0);
    await expect(chart).toBeHidden();

    // Equal unsupported units must not appear in history or a known-marker trend.
    await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      const rows = await bridge.querySql(
        'SELECT id, fhir_json FROM observations'
      );
      for (const row of rows) {
        const observation = JSON.parse(row.fhir_json);
        observation.valueQuantity.unit = 'unknown-unit';
        observation.valueQuantity.code = 'unknown-unit';
        await bridge.executeSql(
          'UPDATE observations SET fhir_json = ?, unit = ? WHERE id = ?',
          [JSON.stringify(observation), 'unknown-unit', row.id]
        );
      }
    });
    await reopenRoute(page);
    await expect(
      history.getByText('unknown-unit', { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByText('Biomarker not found.', { exact: true })
    ).toBeVisible();
    await openRoute(page, '/');
    await expect(page.getByTestId('labs-summary-count')).toHaveText('0');
    await expect(page.getByTestId('labs-summary-grid-cell-718-7')).toHaveCount(
      0
    );
    await expect(chart).toBeHidden();
  });

  test('switches the page to another unit and remembers it', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await seedTestReport(page, {
      date: '2026-05-01',
      biomarkers: [
        {
          name: 'Magnesium',
          value: 2.1,
          unit: 'mg/dL',
          referenceLow: 1.7,
          referenceHigh: 2.2,
        },
      ],
    });
    await seedTestReport(page, {
      date: '2026-06-01',
      biomarkers: [{ name: 'Magnesium', value: 0.91, unit: 'mmol/L' }],
    });
    await openRoute(page, '/biomarker/19123-9');
    const unit = page.getByTestId('biomarker-latest-unit');
    const unitSwitch = page.getByTestId('biomarker-unit-switch');
    const value = page.getByTestId('biomarker-latest-value');
    const limits = page.getByTestId('biomarker-latest-range-limit');
    const history = page.getByTestId('biomarker-history-list');
    // The latest result's unit, with the reported mg/dL range converted.
    await expect(unit).toHaveText('mmol/L');
    await expect(unitSwitch).toHaveAccessibleName(
      'Unit: mmol/L. Switch to mEq/L'
    );
    await expect(value).toHaveText('0.91');
    await expect(limits).toHaveText(['0.7', '0.91']);
    await expect(history.getByText('0.86', { exact: true })).toBeVisible();

    // Each press moves to the next unit, wrapping to the first.
    await unitSwitch.click();
    await expect(unit).toHaveText('mEq/L');
    await expect(value).toHaveText('1.8');
    await unitSwitch.click();
    await expect(unit).toHaveText('mg/dL');
    await expect(value).toHaveText('2.2');
    await expect(limits).toHaveText(['1.7', '2.2']);
    await expect(history.getByText('2.1', { exact: true })).toBeVisible();
    await expect(history.getByText('mmol/L', { exact: true })).toHaveCount(0);
    // The status is still judged in the unit the laboratory reported.
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'In range'
    );

    // Coming back shows the unit last chosen.
    await reopenRoute(page);
    await expect(unit).toHaveText('mg/dL');
    await expect(value).toHaveText('2.2');
  });

  test('opens a biomarker and shows its description, history, and trend', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await seedTestReport(page, {
      id: 'rbc-history-low',
      date: '2026-07-01',
      biomarkers: [
        {
          name: 'Red Blood Cells',
          value: 3.8,
          referenceLow: 3.92,
          referenceHigh: 5.65,
        },
      ],
    });
    await seedTestReport(page, {
      id: 'rbc-history-first',
      date: '2026-08-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 4.5 }],
    });
    await seedTestReport(page, {
      id: 'rbc-history-second',
      date: '2026-09-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 4.8 }],
    });
    await seedTestReport(page, {
      id: 'rbc-history-high',
      date: '2026-10-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 6.1 }],
    });

    await openRoute(page, '/');
    const square = page.getByTestId('labs-summary-grid-cell-789-8');
    await expect(square).toHaveAccessibleName(
      'Red Blood Cells (RBC): Out of range'
    );
    // The grid is visual only; result rows on the summary open details.
    await page.getByTestId('labs-summary-open').click();
    await expandBiomarkerGroups(page.getByTestId('labs-summary'));
    await page.getByTestId('labs-summary-result-789-8').click();

    await expect(page.getByTestId('biomarker-title')).toHaveText(
      'Red Blood Cells (RBC)'
    );
    await page.getByTestId('floating-add-button').click();
    await expect(page.getByTestId('menu-add-lab-results')).toHaveText(
      'Lab Results'
    );
    await page.getByTestId('floating-add-menu-backdrop').click();
    await expect(
      page.getByText(
        'Number of oxygen-carrying red blood cells per volume of blood.'
      )
    ).toBeVisible();
    await expect(page.getByTestId('biomarker-latest')).toBeVisible();
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('6.1');
    await expect(page.getByTestId('biomarker-latest-unit')).toHaveText(
      '10*6/uL'
    );
    await expect(page.getByTestId('biomarker-latest-date')).toHaveText(
      'Oct 1, 2026'
    );
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'Out of range'
    );
    await expect(page.getByTestId('biomarker-loinc')).toHaveText('789-8');
    await expect(page.getByTestId('biomarker-learn')).toBeVisible();
    const affects = page.getByText(/less oxygen may reach tissues/);
    const affectsToggle = page.getByTestId('learn-toggle-what-it-may-affect');
    await expect(affectsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(affects).toBeHidden();
    await affectsToggle.click();
    await expect(affects).toBeVisible();
    await expect(affectsToggle).toHaveAttribute('aria-expanded', 'true');
    await affectsToggle.click();
    await expect(affects).toBeHidden();
    const chart = page.getByTestId('biomarker-chart');
    await expect(chart).toBeVisible();
    await expect(page.getByTestId('biomarker-chart-legend')).toHaveText(
      'Out of rangeIn range'
    );
    // Every value is labelled at its point, oldest first.
    for (const [index, label] of [
      'Jul 1, 2026: 3.8 10*6/uL',
      'Aug 1, 2026: 4.5 10*6/uL',
      'Sep 1, 2026: 4.8 10*6/uL',
      'Oct 1, 2026: 6.1 10*6/uL',
    ].entries())
      await expect(
        page.getByTestId(`biomarker-point-${index}`)
      ).toHaveAccessibleName(label);
    await expect(chart.getByText('4.8', { exact: true })).toBeVisible();

    // The three most recent results show first, newest first.
    await expect(page.getByTestId('biomarker-history-count')).toHaveText('4');
    const results = page
      .getByTestId('biomarker-history-list')
      .getByRole('button', { name: /^View lab result:/ });
    await expect(results).toHaveText([
      /^Oct 1, 20266\.1/,
      /^Sep 1, 20264\.8/,
      /^Aug 1, 20264\.5/,
    ]);
    await expect(
      page.locator('[data-testid^="biomarker-history-range-"]').first()
    ).toBeVisible();
    const showAll = page.getByTestId('biomarker-history-list-toggle');
    await expect(showAll).toHaveText('Show all');
    await showAll.click();
    await expect(results).toHaveCount(4);
    await expect(results.nth(3)).toContainText('Jul 1, 2026');
    await expect(showAll).toHaveText('Show less');

    // The first report's range still applies to the later results.
    const limits = page.getByTestId('biomarker-latest-range-limit');
    await expect(limits).toHaveText(['3.92', '5.65']);

    await results.nth(1).click();
    await expect(page).toHaveURL(/lab-result\/rbc-history-second$/);
  });

  test('calculates the atherogenic index from triglycerides and HDL', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await seedTestReport(page, {
      id: 'aip-first',
      date: '2026-06-01',
      biomarkers: [
        { name: 'Triglycerides', value: 1, unit: 'mmol/L' },
        { name: 'HDL', value: 2.14, unit: 'mmol/L' },
      ],
    });
    await seedTestReport(page, {
      id: 'aip-second',
      date: '2026-09-01',
      biomarkers: [
        { name: 'Triglycerides', value: 150, unit: 'mg/dL' },
        { name: 'HDL', value: 40, unit: 'mg/dL' },
      ],
    });
    await seedTestReport(page, {
      id: 'aip-without-hdl',
      date: '2026-10-01',
      biomarkers: [{ name: 'Triglycerides', value: 1, unit: 'mmol/L' }],
    });

    await openRoute(page, '/');
    const square = page.getByTestId('labs-summary-grid-cell-aip');
    await expect(square).toHaveAccessibleName(
      'Atherogenic Index of Plasma (AIP): No range'
    );
    // The grid is visual only; result rows on the summary open details.
    await page.getByTestId('labs-summary-open').click();
    await expandBiomarkerGroups(page.getByTestId('labs-summary'));
    await page.getByTestId('labs-summary-result-aip').click();

    await expect(page.getByTestId('biomarker-title')).toHaveText(
      'Atherogenic Index of Plasma (AIP)'
    );
    await expect(page.getByTestId('biomarker-calculated')).toHaveText(
      'Calculated'
    );
    await expect(page.getByTestId('biomarker-loinc')).toHaveCount(0);
    await expect(page.getByTestId('biomarker-calculation-formula')).toHaveText(
      'Worked out as log₁₀(triglycerides ÷ HDL), both in mmol/L, from your Triglycerides and HDL Cholesterol results in the same report:'
    );
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('0.21');
    await expect(page.getByTestId('biomarker-latest-date')).toHaveText(
      'Sep 1, 2026'
    );
    const results = page
      .getByTestId('biomarker-history-list')
      .getByRole('button', { name: /^View lab result:/ });
    await expect(results).toHaveText([
      /^Sep 1, 20260\.21/,
      /^Jun 1, 2026-0\.33/,
    ]);
    await expect(
      page.locator(
        '[data-testid^="biomarker-history-"][data-testid$="-calculated"]'
      )
    ).toHaveCount(2);

    // The latest value links the results it was worked out from.
    const triglycerides = page.getByTestId('biomarker-source-result-2571-8');
    await expect(triglycerides).toContainText('150mg/dL');
    await expect(
      page.getByTestId('biomarker-source-result-2085-9')
    ).toContainText('40mg/dL');
    // Related biomarkers: its calculation's inputs, then the rest of Lipids.
    // Unrelated results and those from other categories are left out.
    await expect(
      page.getByTestId('biomarker-related').getByRole('button')
    ).toHaveText([
      /^HDL Cholesterol/,
      /^Triglycerides\d/,
      /^Triglycerides\/HDL Ratio/,
    ]);
    await expect(page.getByTestId('biomarker-conditions')).toHaveCount(0);

    await triglycerides.click();
    await expect(page).toHaveURL(/biomarker\/2571-8$/);

    // Each report lists its calculated value, marked, after its results.
    await openRoute(page, '/lab-result/aip-first');
    await expandBiomarkerGroups(page.getByTestId('lab-result-groups'));
    const row = page.getByTestId('lab-result-groups').getByRole('button', {
      name: 'View biomarker: Atherogenic Index of Plasma (AIP) (calculated)',
    });
    await expect(row).toContainText('-0.33index');
    await expect(
      page.getByTestId('lab-result-grid-cell-aip-first-aip')
    ).toBeVisible();
    await openRoute(page, '/lab-result/aip-without-hdl');
    await expect(
      page.getByTestId('lab-result-results-section-count')
    ).toHaveText('1');

    // A standard value is always worked out from its inputs; recorded, it
    // still shows for reports without them.
    await seedTestReport(page, {
      id: 'ratio-with-inputs',
      date: '2026-08-01',
      biomarkers: [
        { name: 'Total Cholesterol', value: 200, unit: 'mg/dL' },
        { name: 'HDL', value: 50, unit: 'mg/dL' },
        { name: 'Cholesterol/HDL Ratio', value: 9, unit: 'ratio' },
      ],
    });
    await seedTestReport(page, {
      id: 'ratio-alone',
      date: '2026-07-01',
      biomarkers: [
        { name: 'Cholesterol/HDL Ratio', value: 3.5, unit: 'ratio' },
      ],
    });
    await openRoute(page, '/biomarker/9830-1');
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('4');
    await expect(page.getByTestId('biomarker-calculated')).toHaveText(
      'Calculated'
    );
    await expect(page.getByTestId('biomarker-loinc')).toHaveText('9830-1');
    await expect(results).toHaveText([/^Aug 1, 20264/, /^Jul 1, 20263\.5/]);
    // Only the worked-out value is marked as calculated.
    await expect(
      page
        .getByTestId('biomarker-history-list')
        .locator('[data-testid$="-calculated"]')
    ).toHaveCount(1);

    // It can't be recorded: the form only offers tests a report can hold.
    await openRoute(page, '/lab-result/add');
    await page.getByTestId('test-search-input').fill('Atherogenic');
    await expect(page.getByTestId('autocomplete-item-aip')).toHaveCount(0);
  });
});

test.describe('Biomarker ranges', () => {
  test('sets, edits and removes a range that replaces later reports', async ({
    page,
  }) => {
    await seedTestPatient(page);
    const potassium = (
      date: string,
      value: number,
      referenceLow?: number,
      referenceHigh?: number
    ) =>
      seedTestReport(page, {
        date,
        biomarkers: [
          {
            name: 'Potassium',
            value,
            unit: 'mmol/L',
            referenceLow,
            referenceHigh,
          },
        ],
      });
    await potassium('2026-02-10', 4.2, 3.5, 5.1);
    await potassium('2026-05-12', 4.6, 3.5, 5.1);
    await potassium('2026-08-20', 5.0, 3.5, 5.3);
    // Without a printed range, the last one known applies.
    await potassium('2026-09-30', 4.9);

    await openRoute(page, '/biomarker/2823-3');
    const status = page.getByTestId('biomarker-latest-status');
    const limits = page.getByTestId('biomarker-latest-range-limit');
    const legend = page.getByTestId('biomarker-chart-legend');
    const rows = page
      .getByTestId('biomarker-range-list')
      .locator(
        '[data-testid^="biomarker-range-2026-"]:not([data-testid$="-edit"]):not([data-testid$="-row"])'
      );
    await expect(status).toHaveText('In range');
    await expect(limits).toHaveText(['3.5', '5.3']);
    await expect(legend).toHaveText('Out of rangeIn range');
    // The range in use first and marked; a report repeating one adds nothing.
    await expect(page.getByTestId('biomarker-range-count')).toHaveText('2');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('aria-current', 'true');
    await expect(rows.first()).toContainText('3.5–5.3 mmol/L');
    await expect(rows.first()).toContainText('Since Aug 20, 2026');
    await expect(rows.first()).toContainText('From your lab report');
    await page.getByTestId('biomarker-range-list-toggle').click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText('3.5–5.1 mmol/L');
    await expect(rows.nth(1)).not.toHaveAttribute('aria-current', 'true');

    // Set a range with an optimal part, kept exactly as written.
    await page.getByTestId('biomarker-set-range').click();
    await expect(page.getByTestId('biomarker-range-form-title')).toHaveText(
      'Set range: Potassium'
    );
    const field = (limit: string) =>
      page.getByTestId(`biomarker-range-${limit}`);
    const save = page.getByTestId('save-range-button');
    const error = page.getByTestId('biomarker-range-form-error');
    await page
      .getByTestId('biomarker-range-date-picker')
      .locator('input')
      .fill('2026-09-02');
    await field('optimalLow').fill('4.0');
    await save.click();
    await expect(error).toHaveText('Enter a lower or an upper limit.');
    await field('low').fill('3.5');
    await field('high').fill('5,30');
    await field('optimalHigh').fill('5.5');
    await save.click();
    await expect(error).toHaveText(
      'The optimal range must be inside the lower and upper limits.'
    );
    await field('optimalHigh').fill('4.8');
    await save.click();

    await expect(page).toHaveURL(/\/biomarker\/2823-3$/);
    await expect(status).toHaveText('Sufficient');
    await expect(limits).toHaveText(['3.5', '4.0', '4.8', '5.30']);
    await expect(legend).toHaveText('Out of rangeSufficientIn range');
    await expect(rows.first()).toContainText('3.5–5.30 mmol/L');
    await expect(rows.first()).toContainText('Set by you');
    await expect(rows.first()).toHaveAttribute('aria-current', 'true');
    await expect
      .poll(async () => (await getProfileSettings(page)).biomarkerRanges)
      .toEqual({
        '2823-3': [
          {
            low: '3.5',
            high: '5.30',
            optimalLow: '4.0',
            optimalHigh: '4.8',
            unit: 'mmol/L',
            since: '2026-09-02',
            source: 'user',
          },
        ],
      });

    // A later report's own range no longer changes it.
    await potassium('2026-10-05', 5.2, 3.5, 5.0);
    await reopenRoute(page);
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('5.2');
    await expect(status).toHaveText('Sufficient');
    await expect(page.getByTestId('biomarker-range-count')).toHaveText('3');
    await openRoute(page, '/');
    await expect(
      page.getByTestId('labs-summary-grid-cell-2823-3')
    ).toHaveAccessibleName('Potassium: In range');

    // Edit it from its pencil, then remove it.
    await openRoute(page, '/biomarker/2823-3');
    await page.getByTestId('biomarker-range-2026-09-02-edit').click();
    await expect(page.getByTestId('biomarker-range-form-title')).toHaveText(
      'Edit range: Potassium'
    );
    await expect(field('high')).toHaveValue('5.30');
    await field('high').fill('5.0');
    await field('optimalHigh').fill('');
    await field('optimalLow').fill('');
    await save.click();
    await expect(status).toHaveText('Out of range');
    await expect(legend).toHaveText('Out of rangeIn range');
    await expect(rows.first()).toContainText('3.5–5.0 mmol/L');

    await page.getByTestId('biomarker-range-2026-09-02-edit').click();
    await page.getByTestId('biomarker-range-remove-button').click();
    await expect(page).toHaveURL(/\/biomarker\/2823-3$/);
    // The reports' ranges apply again, the latest one too.
    await expect(rows.first()).toContainText('3.5–5 mmol/L');
    await expect(rows.first()).toContainText('Since Oct 5, 2026');
    await expect(rows.first()).toContainText('From your lab report');
    await expect(status).toHaveText('Out of range');
  });

  test('shows No range until the user gives one', async ({ page }) => {
    await seedTestPatient(page);
    await seedTestReport(page, {
      date: '2026-09-30',
      biomarkers: [{ name: 'Potassium', value: 4.4, unit: 'mmol/L' }],
    });
    await openRoute(page, '/');
    await expect(
      page.getByTestId('labs-summary-grid-cell-2823-3')
    ).toHaveAccessibleName('Potassium: No range');
    await openRoute(page, '/biomarker/2823-3');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveCount(0);
    await expect(page.getByTestId('biomarker-range')).toHaveCount(0);
    await expect(page.getByTestId('biomarker-latest-range-limit')).toHaveCount(
      0
    );

    await page.getByTestId('biomarker-set-range').click();
    await page.getByTestId('biomarker-range-high').fill('5.1');
    await page
      .getByTestId('biomarker-range-date-picker')
      .locator('input')
      .fill('2026-09-01');
    await page.getByTestId('save-range-button').click();
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'In range'
    );
    await expect(page.getByTestId('biomarker-range-list')).toContainText(
      'below 5.1 mmol/L'
    );
  });
});
