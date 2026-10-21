import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  openRoute,
} from '@/src/features/testing/testStorage';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'));
  await seedTestPatient(page, { id: 'summary-patient-a' });
});

test('Home shows latest results as a status grid; the summary groups them by status and keeps the period', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [
      { name: 'Hemoglobin', value: 15.2 },
      { name: 'White Blood Cells', value: 3.1 },
      { name: 'Platelets', value: 480 },
    ],
  });
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      { name: 'Hemoglobin', value: 8 },
      { name: 'Red Blood Cells', value: 4.7 },
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
    .getByRole('button');
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
    '10 years',
    '5 years',
    '2 years',
    '1 year',
    '6 months',
    '1 month',
  ]);
  for (const [label, count] of [
    ['10 years', 4],
    ['5 years', 3],
    ['2 years', 3],
    ['6 months', 3],
    ['1 month', 3],
  ] as const) {
    await period.selectOption({ label });
    await expect(home.getByTestId('labs-summary-count')).toHaveText(
      String(count)
    );
    await expect(squares).toHaveCount(count);
  }
  await expect(home.getByTestId('labs-summary-grid-cell-718-7')).toHaveCount(1);
  await expect(home.getByTestId('labs-summary-grid-cell-789-8')).toHaveCount(0);

  await home.getByRole('button', { name: 'Open labs summary' }).click();
  await expect(page).toHaveURL(/labs-summary\?period=1$/);
  const view = page.getByTestId('labs-summary-view');
  const summary = view.getByTestId('labs-summary');
  await expect(
    view.getByRole('heading', { name: 'Labs Summary', exact: true })
  ).toBeVisible();
  await expect(summary.getByRole('combobox', { name: 'Period' })).toHaveValue(
    '1'
  );
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('3');
  await expect(
    summary.getByTestId('labs-summary-groups-outOfRange-count')
  ).toHaveText('2');
  await expect(
    summary.getByTestId('labs-summary-groups-inRange-count')
  ).toHaveText('1');
  const outOfRange = summary.getByTestId('labs-summary-groups-outOfRange');
  await expect(
    outOfRange.getByRole('heading', { name: 'Out of range' })
  ).toBeVisible();
  await expect(
    outOfRange.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(2);
  // Rows show the value and range bar, leaving status, date and code to the page around them.
  const hemoglobin = summary.getByTestId('labs-summary-result-718-7');
  await expect(hemoglobin).toHaveText('Hemoglobin (Hgb)15.2g/dL');
  await expect(summary.getByTestId('labs-summary-range-718-7')).toBeVisible();
  await summary.getByRole('combobox', { name: 'Period' }).selectOption('all');
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('4');
  await expect(
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(4);
  await hemoglobin.click();
  await expect(page).toHaveURL(/biomarker\/718-7$/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'In range'
  );
  await page.getByTestId('back-button').click();
  await expect(view.getByTestId('labs-summary-total')).toHaveText('3');
  await page.getByTestId('back-button').click();
  await expect(page).toHaveURL(/\/$/);
  await home.getByTestId('labs-summary-grid-cell-6690-2').click();
  await expect(page).toHaveURL(/biomarker\/6690-2/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'Out of range'
  );
});

test('in-range-only results leave out the empty group; empty periods and invalid parameters are safe', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [{ name: 'Hemoglobin', value: 15.2 }],
  });
  await openRoute(page, '/');
  const home = page
    .getByTestId('results-scroll-view')
    .getByTestId('labs-summary');
  await expect(
    home.getByTestId('labs-summary-grid-count-outOfRange')
  ).toHaveText('Out of range0');
  await expect(home.getByTestId('labs-summary-grid-count-inRange')).toHaveText(
    'In range1'
  );
  await home.getByRole('button', { name: 'Open labs summary' }).click();
  const view = page.getByTestId('labs-summary-view');
  await expect(view.getByTestId('labs-summary-groups-inRange')).toContainText(
    '15.2'
  );
  await expect(view.getByTestId('labs-summary-groups-outOfRange')).toHaveCount(
    0
  );
  await view.getByRole('combobox', { name: 'Period' }).selectOption('1');
  await expect(view.getByTestId('labs-summary-total')).toHaveText('0');
  await expect(
    view.getByTestId('labs-summary-grid-squares').getByRole('button')
  ).toHaveCount(0);
  await expect(
    view.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(0);
  await openRoute(page, '/labs-summary?period=invalid');
  await expect(view.getByRole('combobox', { name: 'Period' })).toHaveValue(
    'all'
  );
  await expect(view.getByTestId('labs-summary-total')).toHaveText('1');
});

test('summary Search filters the grouped latest results and respects the period', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [
      { name: 'Hemoglobin', value: 15.2 },
      { name: 'White Blood Cells', value: 3.1 },
      { name: 'Platelets', value: 480 },
    ],
  });
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      { name: 'Hemoglobin', value: 8 },
      { name: 'Red Blood Cells', value: 4.7 },
    ],
  });
  await openRoute(page, '/labs-summary');
  const summary = page.getByTestId('labs-summary-view');
  const search = summary.getByRole('textbox', { name: 'Search', exact: true });
  const rows = summary.locator('[data-testid^="labs-summary-result-"]');
  const noResults = summary.getByTestId('labs-summary-no-results');
  await expect(rows).toHaveCount(4);
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
  await summary.getByRole('combobox', { name: 'Period' }).selectOption('1');
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
  await expect(rows).toHaveCount(3);
  await search.fill('718-7');
  await summary.getByTestId('labs-summary-result-718-7').click();
  await expect(page).toHaveURL(/biomarker\/718-7$/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'In range'
  );
});

test('Sort ranks latest biomarkers within each status by deviation, value and clinical date', async ({
  page,
}) => {
  await seedTestReport(page, {
    date: '2026-10-12',
    biomarkers: [{ name: 'Hemoglobin', value: 15.2 }],
  });
  await seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [{ name: 'Platelets', value: 480 }],
  });
  await seedTestReport(page, {
    date: '2026-10-08',
    biomarkers: [{ name: 'White Blood Cells', value: 2250, unit: '/uL' }],
  });
  // Import order differs from measurement order, and the old hemoglobin must be excluded.
  await seedTestReport(page, {
    date: '2020-10-01',
    biomarkers: [
      { name: 'Red Blood Cells', value: 5.5 },
      { name: 'Hemoglobin', value: 8 },
    ],
  });
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  const sort = view.getByRole('combobox', { name: 'Sort', exact: true });
  const rows = view.getByRole('button', { name: /^View biomarker:/ });
  await expect(sort.locator('option')).toHaveText([
    'Largest deviations',
    'Lowest',
    'Highest',
    'Newest',
    'Oldest',
  ]);
  await expect(sort).toHaveValue('deviation');
  const sortBox = (await sort.boundingBox())!;
  const rowBox = (await rows.first().boundingBox())!;
  expect(sortBox.width).toBe(150);
  const periodBox = (await view
    .getByRole('combobox', { name: 'Period' })
    .boundingBox())!;
  expect(periodBox.width).toBe(100);
  expect(periodBox.y).toBeCloseTo(sortBox.y, 0);
  expect(sortBox.x).toBeCloseTo(periodBox.x + periodBox.width + 12, 0);
  const periodLabel = (await view
    .getByText('Period', { exact: true })
    .boundingBox())!;
  const sortLabel = (await view
    .getByText('Sort', { exact: true })
    .boundingBox())!;
  expect(periodLabel.y + periodLabel.height).toBeCloseTo(periodBox.y, 0);
  expect(sortLabel.y + sortLabel.height).toBeCloseTo(sortBox.y, 0);
  expect(periodBox.x).toBeCloseTo(rowBox.x + 20, 0);
  const gridBox = (await view.getByTestId('labs-summary-grid').boundingBox())!;
  expect(periodBox.y).toBeGreaterThan(gridBox.y + gridBox.height);
  const names = {
    wbc: 'White Blood Cells (WBC)',
    plt: 'Platelets (PLT)',
    hgb: 'Hemoglobin (Hgb)',
    rbc: 'Red Blood Cells (RBC)',
  };
  // Out of range (white cells, platelets) always precede in range.
  for (const [choice, order] of [
    ['deviation', ['wbc', 'plt', 'rbc', 'hgb']],
    ['lowest', ['wbc', 'plt', 'hgb', 'rbc']],
    ['highest', ['plt', 'wbc', 'rbc', 'hgb']],
    ['newest', ['plt', 'wbc', 'hgb', 'rbc']],
    ['oldest', ['wbc', 'plt', 'rbc', 'hgb']],
  ] as const) {
    await sort.selectOption(choice);
    await expect(rows).toHaveCount(4);
    for (const [index, key] of order.entries())
      await expect(rows.nth(index)).toContainText(names[key]);
    await expect(view.getByTestId('labs-summary-total')).toHaveText('4');
  }
  await view.getByRole('combobox', { name: 'Period' }).selectOption('1');
  await expect(sort).toHaveValue('oldest');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(names.wbc);
  await expect(view.getByTestId('labs-summary-result-789-8')).toHaveCount(0);
  await sort.selectOption('highest');
  await expect(rows.nth(0)).toContainText(names.plt);
  await expect(rows.nth(1)).toContainText(names.wbc);
});
