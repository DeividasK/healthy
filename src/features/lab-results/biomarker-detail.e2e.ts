import {
  test,
  expect,
  clearAppStorage,
} from '@/src/features/testing/testStorage';
import {
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/testSeed';

test.describe('Biomarker detail', () => {
  test('rejects seed biomarkers and units outside the CBC catalog', async ({
    page,
  }) => {
    await clearAppStorage(page);
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
    expect(record.observations[0].referenceRange[0].low.value).toBe(135);
    expect(record.observations[1].valueQuantity.code).toBe('10*6/uL');
    await expect(
      seedTestReport(page, {
        biomarkers: [{ name: 'Custom Marker', value: 42, unit: 'custom-unit' }],
      })
    ).rejects.toThrow('is not in the CBC catalog');
    const rejectedReports = await page.evaluate(async () =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM diagnostic_reports WHERE id = ?',
        ['invalid-unit']
      )
    );
    expect(rejectedReports).toHaveLength(0);
  });

  test('shows only the active patient on direct entry and patient changes', async ({
    page,
  }) => {
    await clearAppStorage(page);
    await seedTestPatient(page, {
      id: 'history-patient-a',
      givenName: 'First',
    });
    await seedTestReport(page, {
      biomarkers: [{ name: 'Red Blood Cells', value: 4.5 }],
    });
    await seedTestPatient(page, {
      id: 'history-patient-b',
      givenName: 'Second',
    });
    await seedTestReport(page, {
      biomarkers: [{ name: 'Red Blood Cells', value: 6.1 }],
    });
    await page.goto('/biomarker/789-8');
    const latest = page.getByTestId('biomarker-latest-value');
    const history = page.getByTestId('biomarker-history-list');
    await expect(latest).toHaveText('6.1');
    await expect(history.getByText('4.5', { exact: true })).toHaveCount(0);
    await page.evaluate(async () =>
      (window as any).__HEALTHY_TEST_BRIDGE__.seedPatient({
        id: 'history-patient-a',
        givenName: 'First',
      })
    );
    await expect(latest).toHaveText('4.5');
    await expect(history.getByText('6.1', { exact: true })).toHaveCount(0);
    await page.evaluate(async () =>
      (window as any).__HEALTHY_TEST_BRIDGE__.seedPatient({
        id: 'history-patient-b',
        givenName: 'Second',
      })
    );
    await expect(latest).toHaveText('6.1');
    await expect(history.getByText('4.5', { exact: true })).toHaveCount(0);
  });

  test('uses matching reference units and normalizes mixed-unit history', async ({
    page,
  }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
    for (const result of [
      { date: '2026-09-01', value: '14.5', unit: 'g/dL' },
      { date: '2026-10-01', value: '150', unit: 'g/L' },
    ]) {
      await page.goto('/lab-result/add');
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
    expect(latestObservation.referenceRange[0]).toMatchObject({
      low: { value: 135, code: 'g/L' },
      high: { value: 175, code: 'g/L' },
    });
    await expect(page.getByTestId('biomarker-row-718-7').first()).toContainText(
      'Normal'
    );

    // Imported observations may omit both interpretation and referenceRange.
    await page.evaluate(async (id) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      const [row] = await bridge.querySql(
        'SELECT fhir_json FROM observations WHERE id = ?',
        [id]
      );
      const observation = JSON.parse(row.fhir_json);
      delete observation.referenceRange;
      delete observation.interpretation;
      await bridge.executeSql(
        'UPDATE observations SET fhir_json = ? WHERE id = ?',
        [JSON.stringify(observation), id]
      );
    }, latestObservation.id);
    await page.goto('/biomarker/718-7');
    await expect(page.getByTestId('biomarker-latest-value')).toHaveText('150');
    await expect(page.getByTestId('biomarker-latest-unit')).toHaveText('g/L');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'Normal'
    );
    const chart = page.getByTestId('biomarker-chart');
    await expect(chart.getByText('135', { exact: true })).toBeVisible();
    await expect(chart.getByText('175', { exact: true })).toBeVisible();
    const history = page.getByTestId('biomarker-history-list');
    await expect(history.getByText('14.5', { exact: true })).toBeVisible();
    await expect(history.getByText('g/dL', { exact: true })).toBeVisible();
    await expect(history.getByText('Normal', { exact: true })).toHaveCount(2);
    await expect(
      history.locator('[data-testid^="biomarker-history-range-"]')
    ).toHaveCount(2);
    await page.getByTestId('biomarker-point-0').hover();
    await expect(page.getByTestId('biomarker-tooltip')).toContainText('145');
    await expect(page.getByTestId('biomarker-tooltip')).toContainText('g/L');
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
    await page.goto('/');
    await expect(page.getByTestId('biomarker-row-718-7').first()).toContainText(
      'High'
    );
    await page.goto('/biomarker/718-7');
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'High'
    );
    await expect(chart.getByText('140', { exact: true })).toBeVisible();
    await expect(chart.getByText('149', { exact: true })).toBeVisible();
    await expect(
      history.getByTestId(`biomarker-status-${latestObservation.id}`)
    ).toHaveText('High');

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
    await page.reload();
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
    await page.reload();
    await expect(
      history.getByText('unknown-unit', { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByText('Biomarker not found.', { exact: true })
    ).toBeVisible();
    await page.goto('/');
    await expect(page.getByTestId(/^report-card-/).first()).toBeVisible();
    await expect(page.getByTestId('biomarker-row-718-7')).toHaveCount(0);
    await expect(chart).toBeHidden();
  });

  test('opens a biomarker and shows its description, history, and trend', async ({
    page,
  }) => {
    await clearAppStorage(page);
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

    await page.goto('/');
    const row = page.getByTestId('biomarker-row-789-8').first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.getByTestId('biomarker-title')).toHaveText(
      'Red Blood Cells (RBC)'
    );
    await page.getByTestId('floating-add-button').click();
    await expect(page.getByTestId('menu-add-lab-results')).toHaveText(
      'Add Lab Results'
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
    await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
      'High'
    );
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
    await expect(page.getByTestId('biomarker-chart')).toBeVisible();
    const historyList = page.getByTestId('biomarker-history-list');
    await expect(historyList.getByText('4.8')).toBeVisible();
    await expect(historyList.getByText('4.5')).toBeVisible();
    await expect(historyList.getByText('Low', { exact: true })).toBeVisible();
    await expect(
      historyList.getByText('Normal', { exact: true }).first()
    ).toBeVisible();
    await expect(historyList.getByText('High', { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-testid^="biomarker-history-range-"]').first()
    ).toBeVisible();

    const historyListToggle = page.getByTestId('biomarker-history-list-toggle');
    await expect(historyListToggle).toHaveText('List');
    await expect(historyListToggle).toHaveAttribute('aria-expanded', 'true');
    await historyListToggle.click();
    await expect(historyList).toBeHidden();
    await expect(historyListToggle).toHaveAttribute('aria-expanded', 'false');
    await historyListToggle.click();
    await expect(historyList).toBeVisible();

    await page.getByTestId('biomarker-point-2').hover();
    const tooltip = page.getByTestId('biomarker-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('2026');
    await expect(tooltip).toContainText('4.8');
  });
});
