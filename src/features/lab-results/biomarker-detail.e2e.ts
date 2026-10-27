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
} from '@/src/features/testing/testSeed';

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
    // Saved results carry no range: it follows the profile when shown.
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
      biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
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
    // The profile has a gender, so nothing is asked for.
    await expect(page.getByTestId('labs-summary-range-notice')).toHaveCount(0);

    await openRoute(page, '/biomarker/718-7');
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('150');
    const unitPicker = page
      .getByTestId('biomarker-unit-picker')
      .locator('select');
    await expect(unitPicker).toHaveValue('g/L');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'In range'
    );
    await expect(page.getByTestId('biomarker-loinc')).toHaveText('718-7');
    // The range for men, in the result's unit, and why it applies.
    const limits = page.getByTestId('biomarker-latest-range-limit');
    await expect(limits).toHaveText(['132', '166']);
    await expect(page.getByTestId('biomarker-range-explanation')).toHaveText(
      'Typical Hemoglobin (Hgb) levels differ by sex. This range is for men. Laboratories set their own ranges, so yours may differ a little.'
    );
    await expect(page.getByTestId('biomarker-range-notice')).toHaveCount(0);
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
    await expect(page.getByTestId('biomarker-range-explanation')).toHaveText(
      'This range comes from your laboratory report.'
    );

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
      biomarkers: [{ name: 'Magnesium', value: 2.1, unit: 'mg/dL' }],
    });
    await seedTestReport(page, {
      date: '2026-06-01',
      biomarkers: [{ name: 'Magnesium', value: 0.91, unit: 'mmol/L' }],
    });
    await openRoute(page, '/biomarker/19123-9');
    const unitPicker = page
      .getByTestId('biomarker-unit-picker')
      .locator('select');
    const value = page.getByTestId('biomarker-latest-value');
    const limits = page.getByTestId('biomarker-latest-range-limit');
    const history = page.getByTestId('biomarker-history-list');
    // The latest result's unit, with the catalog's mg/dL range converted.
    await expect(unitPicker).toHaveValue('mmol/L');
    await expect(value).toHaveText('0.91');
    await expect(limits).toHaveText(['0.7', '0.91']);
    await expect(history.getByText('0.86', { exact: true })).toBeVisible();

    await unitPicker.selectOption('mg/dL');
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
    await expect(unitPicker).toHaveValue('mg/dL');
    await expect(value).toHaveText('2.2');
  });

  test('opens a biomarker and shows its description, history, and trend', async ({
    page,
  }) => {
    await seedTestPatient(page);
    await seedTestReport(page, {
      id: 'rbc-history-low',
      date: '2026-07-01',
      biomarkers: [{ name: 'Red Blood Cells', value: 3.8 }],
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
    await expect(
      page.getByTestId('biomarker-unit-picker').locator('select')
    ).toHaveValue('10*6/uL');
    await expect(page.getByTestId('biomarker-latest-date')).toHaveText(
      'Oct 1, 2026'
    );
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'Out of range'
    );
    await expect(page.getByTestId('biomarker-loinc')).toHaveText('789-8');
    await expect(page.getByTestId('biomarker-learn')).toBeVisible();
    const whyItMatters = page.getByText(
      /carries oxygen from the lungs to the body’s tissues/
    );
    const whyItMattersToggle = page.getByTestId('learn-toggle-why-it-matters');
    await expect(whyItMattersToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(whyItMatters).toBeHidden();
    await whyItMattersToggle.click();
    await expect(whyItMatters).toBeVisible();
    await expect(whyItMattersToggle).toHaveAttribute('aria-expanded', 'true');
    await whyItMattersToggle.click();
    await expect(whyItMatters).toBeHidden();
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

    // Red blood cell ranges depend on sex, which the profile doesn't say.
    const explanation = page.getByTestId('biomarker-range-explanation');
    await expect(explanation).toHaveText(
      'Typical Red Blood Cells (RBC) levels differ by sex. Your profile doesn’t have your gender, so a general adult range is shown. Laboratories set their own ranges, so yours may differ a little.'
    );
    const limits = page.getByTestId('biomarker-latest-range-limit');
    await expect(limits).toHaveText(['3.92', '5.65']);
    await expect(page.getByTestId('biomarker-range-notice')).toBeVisible();

    await results.nth(1).click();
    await expect(page).toHaveURL(/lab-result\/rbc-history-second$/);

    // The lab result asks for the gender too, and opens the profile with it.
    const notice = page.getByTestId('lab-result-range-notice');
    await expect(notice).toContainText(
      'Typical ranges for some results depend on your gender.'
    );
    await page.getByRole('button', { name: 'Add gender' }).click();
    await expect(page).toHaveURL(/profile\/[^/]+\/edit\?show=gender$/);
    await expect(page.getByTestId('patient-birth-date-picker')).toHaveCount(0);
    await page.getByTestId('patient-gender-select').selectOption('female');
    await page.getByTestId('save-profile-button').click();
    await expect(page).toHaveURL(/lab-result\/rbc-history-second$/);
    await expect(notice).toHaveCount(0);

    // The biomarker now shows, and explains, the range for women.
    await openRoute(page, '/biomarker/789-8');
    await expect(explanation).toHaveText(
      'Typical Red Blood Cells (RBC) levels differ by sex. This range is for women. Laboratories set their own ranges, so yours may differ a little.'
    );
    await expect(limits).toHaveText(['3.92', '5.13']);
    await expect(page.getByTestId('biomarker-range-notice')).toHaveCount(0);
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
      'Atherogenic Index of Plasma (AIP): Out of range'
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
