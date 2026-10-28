import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  openRoute,
  useSingleColumnLayout,
  expandBiomarkerGroups,
} from '@/src/features/testing/testStorage';

/** Opens the summary's filters; Done closes them. */
async function openFilters(page: Page) {
  await page.getByTestId('labs-summary-filter-button').click();
  const filters = page.getByTestId('labs-summary-filters');
  return {
    period: filters.getByRole('combobox', { name: 'Time period' }),
    sort: filters.getByRole('combobox', { name: 'Sort' }),
    reset: filters.getByTestId('labs-summary-filters-reset'),
    done: async () => {
      await filters.getByTestId('labs-summary-filters-done').click();
      await expect(filters).toBeHidden();
    },
  };
}

test.beforeEach(async ({ page }) => {
  // The single-column summary; desktop's list beside the detail is tested
  // under 'Desktop' below.
  await useSingleColumnLayout(page);
  await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'));
  await seedTestPatient(page, { id: 'summary-patient-a' });
});

test('Home shows latest results as a status grid; the summary groups them by status and keeps the period', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 15.2,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
      {
        name: 'White Blood Cells',
        value: 3.1,
        referenceLow: 4.5,
        referenceHigh: 11,
      },
      { name: 'Platelets', value: 480, referenceLow: 150, referenceHigh: 450 },
    ],
  });
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      { name: 'Hemoglobin', value: 8, referenceLow: 11.6, referenceHigh: 16.6 },
      {
        name: 'Red Blood Cells',
        value: 4.7,
        referenceLow: 3.92,
        referenceHigh: 5.65,
      },
    ],
  });
  await seedTestCondition(page, {
    id: 'summary-condition',
    title: 'Summary order',
  });
  await openRoute(page, '/');
  const home = page
    .getByTestId('results-scroll-view')
    .getByTestId('labs-summary');

  // Home places the summary after the conditions, counting each biomarker's
  // latest result whatever order reports were imported in.
  const conditionY = (await page
    .getByTestId('condition-card-summary-condition')
    .boundingBox())!.y;
  expect((await home.boundingBox())!.y).toBeGreaterThan(conditionY);
  await expect(home.getByTestId('labs-summary-count')).toHaveText('4');
  await expect(
    home.getByTestId('labs-summary-grid-count-outOfRange')
  ).toHaveText('Out of range2');
  await expect(home.getByTestId('labs-summary-grid-count-inRange')).toHaveText(
    'In range2'
  );
  // Low and high results are both out of range, and come first.
  const squares = home
    .getByTestId('labs-summary-grid-squares')
    .getByRole('img');
  for (const [index, name] of [
    'Platelets (PLT): Out of range',
    'White Blood Cells (WBC): Out of range',
    'Hemoglobin (Hgb): In range',
    'Red Blood Cells (RBC): In range',
  ].entries())
    await expect(squares.nth(index)).toHaveAccessibleName(name);
  await expect(home.getByTestId('labs-summary-grid-cell-777-3')).toHaveCSS(
    'background-color',
    'rgb(199, 124, 78)'
  );
  await expect(home.getByTestId('labs-summary-grid-cell-718-7')).toHaveCSS(
    'background-color',
    'rgb(61, 100, 80)'
  );
  // Home lists no biomarkers and has no search or sort.
  await expect(
    home.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(0);
  await expect(home.getByRole('textbox', { name: 'Search' })).toHaveCount(0);
  await expect(home.getByRole('combobox', { name: 'Sort' })).toHaveCount(0);

  const period = home.getByRole('combobox', { name: 'Period' });
  await expect(period.locator('option')).toHaveText([
    'All time',
    '6 months',
    '1 year',
    '2 years',
  ]);
  for (const [label, count] of [
    ['2 years', 3],
    ['1 year', 3],
    ['6 months', 3],
  ] as const) {
    await period.selectOption({ label });
    await expect(home.getByTestId('labs-summary-count')).toHaveText(
      String(count)
    );
    await expect(squares).toHaveCount(count);
  }
  await expect(home.getByTestId('labs-summary-grid-cell-718-7')).toHaveCount(1);
  await expect(home.getByTestId('labs-summary-grid-cell-789-8')).toHaveCount(0);

  // The summary takes Home's period as its own, then drops it from the URL.
  await home.getByRole('button', { name: 'Open biomarkers' }).click();
  await expect(page).toHaveURL(/labs-summary$/);
  const view = page.getByTestId('labs-summary-view');
  const summary = view.getByTestId('labs-summary');
  await expect(
    view.getByRole('heading', { name: 'Biomarkers', exact: true })
  ).toBeVisible();
  await expect(summary.getByRole('combobox')).toHaveCount(0);
  await expect(
    summary.getByRole('button', {
      name: 'Filter latest results, filters on',
    })
  ).toBeVisible();
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('3');
  await expect(
    summary.getByTestId('labs-summary-groups-outOfRange-count')
  ).toHaveText('2');
  await expect(
    summary.getByTestId('labs-summary-groups-inRange-count')
  ).toHaveText('1');
  await summary.getByTestId('labs-summary-grid-cell-718-7').click();
  await expect(page).toHaveURL(/labs-summary$/);
  await expect(
    summary.getByTestId('labs-summary-grid-squares').getByRole('button')
  ).toHaveCount(0);
  const outOfRange = summary.getByTestId('labs-summary-groups-outOfRange');
  await expect(
    outOfRange.getByRole('heading', { name: 'Out of range' })
  ).toBeVisible();
  // Groups start collapsed; their headings open and close them.
  const outOfRangeToggle = outOfRange.getByRole('button', {
    name: 'Out of range: 2 biomarkers',
  });
  await expect(outOfRangeToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(0);
  await outOfRangeToggle.click();
  await expect(outOfRangeToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(
    summary.getByTestId('labs-summary-groups-inRange-toggle')
  ).toHaveAttribute('aria-expanded', 'false');
  await expect(
    outOfRange.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(2);
  // Rows show the value and range bar, leaving status, date and code to the page around them.
  await expandBiomarkerGroups(summary);
  const hemoglobin = summary.getByTestId('labs-summary-result-718-7');
  await expect(hemoglobin).toHaveText('Hemoglobin (Hgb)15.2g/dL');
  await expect(summary.getByTestId('labs-summary-range-718-7')).toBeVisible();
  const filters = await openFilters(page);
  await expect(filters.period).toHaveValue('6');
  await filters.period.selectOption('all');
  await filters.done();
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('4');
  await expect(
    summary.getByRole('button', { name: 'Filter latest results' })
  ).toBeVisible();
  await expect(
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(4);
  await hemoglobin.click();
  await expect(page).toHaveURL(/biomarker\/718-7$/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'In range'
  );
  await page.getByTestId('back-button').click();
  await expect(view.getByTestId('labs-summary-total')).toHaveText('4');
  await page.getByTestId('back-button').click();
  await expect(page).toHaveURL(/\/$/);
  await home.getByTestId('labs-summary-grid-cell-6690-2').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    home.getByTestId('labs-summary-grid-squares').getByRole('button')
  ).toHaveCount(0);
});

test('the key and groups list only statuses with results; empty periods and invalid parameters are safe', async ({
  page,
}) => {
  const { observations } = await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 15.2,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
      { name: 'Platelets', value: 250, referenceLow: 150, referenceHigh: 450 },
    ],
  });
  // An imported result without a value cannot be compared with its range.
  await page.evaluate(async (id) => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    const [row] = await bridge.querySql(
      'SELECT fhir_json FROM observations WHERE id = ?',
      [id]
    );
    const observation = JSON.parse(row.fhir_json);
    delete observation.valueQuantity.value;
    delete observation.interpretation;
    await bridge.executeSql(
      'UPDATE observations SET fhir_json = ? WHERE id = ?',
      [JSON.stringify(observation), id]
    );
  }, observations[1].id);
  await openRoute(page, '/');
  const home = page
    .getByTestId('results-scroll-view')
    .getByTestId('labs-summary');
  await expect(home.getByTestId('labs-summary-grid-status-counts')).toHaveText(
    'In range1No range1'
  );
  await expect(
    home.getByTestId('labs-summary-grid-count-outOfRange')
  ).toHaveCount(0);
  await expect(
    home.getByTestId('labs-summary-grid-cell-777-3')
  ).toHaveAccessibleName('Platelets (PLT): No range');
  await expect(home.getByTestId('labs-summary-grid-cell-777-3')).toHaveCSS(
    'background-color',
    'rgb(217, 219, 215)'
  );
  await home.getByRole('button', { name: 'Open biomarkers' }).click();
  const view = page.getByTestId('labs-summary-view');
  await expandBiomarkerGroups(view);
  await expect(view.getByTestId('labs-summary-groups-inRange')).toContainText(
    '15.2'
  );
  await expect(view.getByTestId('labs-summary-groups-outOfRange')).toHaveCount(
    0
  );
  await expect(
    view.getByTestId('labs-summary-groups-noRange-count')
  ).toHaveText('1');
  const filters = await openFilters(page);
  await filters.period.selectOption('6');
  await filters.done();
  await expect(view.getByTestId('labs-summary-total')).toHaveText('0');
  await expect(
    view.getByTestId('labs-summary-grid-squares').getByRole('img')
  ).toHaveCount(0);
  await expect(view.getByTestId('labs-summary-grid-status-counts')).toHaveText(
    ''
  );
  await expect(
    view.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(0);
  // An unknown period in the URL keeps the saved one.
  await openRoute(page, '/labs-summary?period=invalid');
  await expect(page).toHaveURL(/labs-summary$/);
  await expect(view.getByTestId('labs-summary-total')).toHaveText('0');
  await (await openFilters(page)).reset.click();
  await expect(view.getByTestId('labs-summary-total')).toHaveText('2');
});

test('summary Search filters the grouped latest results and respects the period', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 15.2,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
      {
        name: 'White Blood Cells',
        value: 3.1,
        referenceLow: 4.5,
        referenceHigh: 11,
      },
      { name: 'Platelets', value: 480, referenceLow: 150, referenceHigh: 450 },
    ],
  });
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      { name: 'Hemoglobin', value: 8, referenceLow: 11.6, referenceHigh: 16.6 },
      {
        name: 'Red Blood Cells',
        value: 4.7,
        referenceLow: 3.92,
        referenceHigh: 5.65,
      },
    ],
  });
  await openRoute(page, '/labs-summary');
  const summary = page.getByTestId('labs-summary-view');
  const search = summary.getByRole('textbox', { name: 'Search', exact: true });
  const rows = summary.locator('[data-testid^="labs-summary-result-"]');
  const noResults = summary.getByTestId('labs-summary-no-results');
  await expect(rows).toHaveCount(0);
  // Searching opens every group with a match.
  await search.fill(' hGb ');
  await expect(rows).toHaveCount(1);
  await expect(summary.getByTestId('labs-summary-result-718-7')).toContainText(
    '15.2'
  );
  await expect(
    summary.getByTestId('labs-summary-groups-inRange-count')
  ).toHaveText('1');
  // The grid and total keep every latest result.
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('4');
  await search.fill('BLOOD');
  await expect(rows).toHaveCount(2);
  const filters = await openFilters(page);
  await filters.period.selectOption('6');
  await filters.done();
  await expect(rows).toHaveCount(1);
  await expect(
    summary
      .getByTestId('labs-summary-groups-outOfRange')
      .getByTestId('labs-summary-result-6690-2')
  ).toBeVisible();
  await search.fill('Red Blood Cells');
  await expect(noResults).toHaveText('No search results found');
  await expect(rows).toHaveCount(0);
  await search.fill('does not exist');
  await expect(noResults).toBeVisible();
  await search.fill('   ');
  await expect(noResults).toHaveCount(0);
  await expect(rows).toHaveCount(0);
  await expandBiomarkerGroups(summary);
  await expect(rows).toHaveCount(3);
  await search.fill('718-7');
  await summary.getByTestId('labs-summary-result-718-7').click();
  await expect(page).toHaveURL(/biomarker\/718-7$/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'In range'
  );
});

test('the heading filter sorts latest biomarkers within each status by deviation or clinical date, and is remembered', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2026-10-12',
    biomarkers: [
      {
        name: 'Hemoglobin',
        value: 15.2,
        referenceLow: 11.6,
        referenceHigh: 16.6,
      },
    ],
  });
  await seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [
      { name: 'Platelets', value: 480, referenceLow: 150, referenceHigh: 450 },
    ],
  });
  await seedTestReport(page, {
    date: '2026-10-08',
    biomarkers: [
      {
        name: 'White Blood Cells',
        value: 2250,
        unit: '/uL',
        referenceLow: 4500,
        referenceHigh: 11000,
      },
    ],
  });
  // Import order differs from measurement order, and the old hemoglobin must be excluded.
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      {
        name: 'Red Blood Cells',
        value: 5.5,
        referenceLow: 3.92,
        referenceHigh: 5.65,
      },
      { name: 'Hemoglobin', value: 8, referenceLow: 11.6, referenceHigh: 16.6 },
    ],
  });
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  const rows = view.getByRole('button', { name: /^View biomarker:/ });
  await expandBiomarkerGroups(view);
  // The filter button sits at the end of the Latest results heading.
  const heading = view.getByRole('heading', { name: 'Latest results' });
  const button = view.getByRole('button', { name: 'Filter latest results' });
  const headingBox = (await heading.boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  const gridBox = (await view.getByTestId('labs-summary-grid').boundingBox())!;
  expect(buttonBox.y + buttonBox.height).toBeLessThan(gridBox.y);
  expect(buttonBox.x + buttonBox.width).toBeCloseTo(
    gridBox.x + gridBox.width,
    0
  );
  expect(
    Math.abs(
      buttonBox.y +
        buttonBox.height / 2 -
        (headingBox.y + headingBox.height / 2)
    )
  ).toBeLessThan(2);

  const filters = await openFilters(page);
  await expect(filters.period.locator('option')).toHaveText([
    'All time',
    '6 months',
    '1 year',
    '2 years',
  ]);
  await expect(filters.sort.locator('option')).toHaveText([
    'Largest deviations',
    'Newest',
    'Oldest',
  ]);
  await expect(filters.sort).toHaveValue('deviation');
  const names = {
    wbc: 'White Blood Cells (WBC)',
    plt: 'Platelets (PLT)',
    hgb: 'Hemoglobin (Hgb)',
    rbc: 'Red Blood Cells (RBC)',
  };
  // Out of range (white cells, platelets) always precede in range.
  for (const [choice, order] of [
    ['deviation', ['wbc', 'plt', 'rbc', 'hgb']],
    ['newest', ['plt', 'wbc', 'hgb', 'rbc']],
    ['oldest', ['wbc', 'plt', 'rbc', 'hgb']],
  ] as const) {
    await filters.sort.selectOption(choice);
    await expect(rows).toHaveCount(4);
    for (const [index, key] of order.entries())
      await expect(rows.nth(index)).toContainText(names[key]);
    await expect(view.getByTestId('labs-summary-total')).toHaveText('4');
  }
  await filters.period.selectOption('6');
  await expect(filters.sort).toHaveValue('oldest');
  await filters.done();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(names.wbc);
  await expect(view.getByTestId('labs-summary-result-789-8')).toHaveCount(0);

  await test.step('remembers the filters after a restart', async () => {
    await page.reload();
    await expandBiomarkerGroups(view);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(names.wbc);
    const saved = await openFilters(page);
    await expect(saved.period).toHaveValue('6');
    await expect(saved.sort).toHaveValue('oldest');
    await saved.reset.click();
    await expect(saved.period).toHaveValue('all');
    await expect(saved.sort).toHaveValue('deviation');
    await saved.done();
    await expect(rows).toHaveCount(4);
    await expect(
      view.getByRole('button', { name: 'Filter latest results' })
    ).toBeVisible();
  });
});
