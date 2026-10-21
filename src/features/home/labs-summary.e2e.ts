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

test('See All Biomarkers preserves the period and shows latest normal, low and high results', async ({
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
  await expect(home.getByTestId('labs-summary-divider')).toHaveCount(1);
  const conditionY = (await page
    .getByTestId('condition-card-summary-condition')
    .boundingBox())!.y;
  expect((await home.boundingBox())!.y).toBeGreaterThan(conditionY);
  await expect(home.getByTestId('labs-summary-total')).toHaveText('4');
  await expect(home.getByText('Biomarkers', { exact: true })).toBeVisible();
  await expect(home.getByTestId('labs-summary-count-Low')).toHaveText('Low1');
  await expect(home.getByTestId('labs-summary-count-Normal')).toHaveText(
    'Normal2'
  );
  await expect(home.getByTestId('labs-summary-count-High')).toHaveText('High1');
  await expect(home.getByText('Out of Range', { exact: true })).toBeVisible();
  await expect(home.getByTestId('labs-summary-result-6690-2')).toContainText(
    'Low'
  );
  await expect(home.getByTestId('labs-summary-result-777-3')).toContainText(
    'High'
  );
  await expect(home.getByTestId('labs-summary-segment-718-7')).toHaveAttribute(
    'stroke',
    '#5a8669'
  );
  await expect(home.getByTestId('labs-summary-segment-6690-2')).toHaveAttribute(
    'stroke',
    '#c77c4e'
  );
  await expect(home.getByTestId('labs-summary-segment-777-3')).toHaveAttribute(
    'stroke',
    '#c77c4e'
  );
  await expect(home.getByTestId('labs-summary-chart')).toHaveAttribute(
    'aria-label',
    '4 biomarkers: 2 normal, 1 low, 1 high'
  );
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
    await expect(home.getByTestId('labs-summary-total')).toHaveText(
      String(count)
    );
    await expect(
      home
        .locator('[data-testid^="labs-summary-result-"]')
        .filter({ has: page.getByText(/LOINC:/) })
    ).toHaveCount(2);
    await expect(
      home.locator('[data-testid^="labs-summary-segment-"]')
    ).toHaveCount(count);
  }
  await period.selectOption('1');
  await expect(home.getByTestId('labs-summary-total')).toHaveText('3');
  await expect(home.getByTestId('labs-summary-result-718-7')).toHaveCount(0);
  await expect(
    home.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(2);
  await home
    .getByRole('button', { name: 'See All Biomarkers', exact: true })
    .click();
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
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(3);
  await expect(summary.getByTestId('labs-summary-result-718-7')).toContainText(
    '15.2'
  );
  await expect(summary.getByTestId('labs-summary-result-718-7')).toContainText(
    'Normal'
  );
  await expect(summary.getByTestId('labs-summary-result-6690-2')).toContainText(
    'Low'
  );
  await expect(summary.getByTestId('labs-summary-result-777-3')).toContainText(
    'High'
  );
  await expect(summary.getByText('Out of Range', { exact: true })).toHaveCount(
    0
  );
  await expect(
    summary.getByRole('button', { name: 'See All Biomarkers' })
  ).toHaveCount(0);
  await expect(summary.getByTestId('labs-summary-divider')).toHaveCount(2);
  await summary.getByRole('combobox', { name: 'Period' }).selectOption('all');
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('4');
  await expect(
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(4);
  await summary.getByTestId('labs-summary-result-718-7').click();
  await expect(page).toHaveURL(/biomarker\/718-7$/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'Normal'
  );
  await page.getByTestId('back-button').click();
  await expect(view.getByTestId('labs-summary-total')).toHaveText('3');
  await page.getByTestId('back-button').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(home.getByText('Out of Range', { exact: true })).toBeVisible();
  await home.getByTestId('labs-summary-result-6690-2').click();
  await expect(page).toHaveURL(/biomarker\/6690-2/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText('Low');
});

test('normal-only results keep the home button available; empty periods and invalid parameters are safe', async ({
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
  await expect(home.getByText('Out of Range', { exact: true })).toBeVisible();
  await expect(home.getByTestId('labs-summary-out-of-range-count')).toHaveText(
    '(0 Biomarkers)'
  );
  await expect(
    home.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(0);
  await home.getByRole('button', { name: 'See All Biomarkers' }).click();
  const view = page.getByTestId('labs-summary-view');
  await expect(view.getByTestId('labs-summary-result-718-7')).toContainText(
    'Normal'
  );
  await view.getByRole('combobox', { name: 'Period' }).selectOption('1');
  await expect(view.getByTestId('labs-summary-total')).toHaveText('0');
  await expect(
    view.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(0);
  await openRoute(page, '/labs-summary?period=invalid');
  await expect(view.getByRole('combobox', { name: 'Period' })).toHaveValue(
    'all'
  );
  await expect(view.getByTestId('labs-summary-total')).toHaveText('1');
});

test('home Search shows latest matches including normal results and respects the period', async ({
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
  await openRoute(page, '/');
  const summary = page
    .getByTestId('results-scroll-view')
    .getByTestId('labs-summary');
  const search = summary.getByRole('textbox', { name: 'Search', exact: true });
  const results = summary.getByTestId('labs-summary-search-results');
  const button = summary.getByRole('button', { name: 'See All Biomarkers' });
  await expect(button).toBeVisible();
  await expect(
    summary.getByTestId('labs-summary-out-of-range-count')
  ).toHaveText('(2 Biomarkers)');
  const summarySize = (await summary.boundingBox())!;
  const buttonSize = (await button.boundingBox())!;
  expect(buttonSize.width).toBeLessThan(summarySize.width);
  const periodBox = (await summary
    .getByRole('combobox', { name: 'Period' })
    .boundingBox())!;
  expect(periodBox.width).toBe(100);
  await expect(
    page.getByTestId('labs-summary-period-anchor').filter({ visible: true })
  ).toHaveCSS('position', 'absolute');
  expect(periodBox.x).toBeCloseTo(summarySize.x, 0);
  const chartBox = (await summary
    .getByTestId('labs-summary-chart')
    .boundingBox())!;
  const countsBox = (await summary
    .getByTestId('labs-summary-status-counts')
    .boundingBox())!;
  expect(countsBox.y + countsBox.height / 2).toBeCloseTo(
    chartBox.y + chartBox.height / 2,
    0
  );
  expect(countsBox.x - (chartBox.x + chartBox.width)).toBeCloseTo(4, 0);
  await expect(results).toHaveCount(0);
  await search.fill(' hGb ');
  await expect(
    results.getByTestId('labs-summary-search-result-718-7')
  ).toContainText('15.2');
  await expect(
    results.getByTestId('labs-summary-search-result-718-7')
  ).toContainText('Normal');
  await expect(
    results.locator('[data-testid^="labs-summary-search-result-"]')
  ).toHaveCount(1);
  await expect(
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(2);
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('4');
  await search.fill('BLOOD');
  await expect(
    results.locator('[data-testid^="labs-summary-search-result-"]')
  ).toHaveCount(2);
  await summary.getByRole('combobox', { name: 'Period' }).selectOption('1');
  await expect(
    results.locator('[data-testid^="labs-summary-search-result-"]')
  ).toHaveCount(1);
  await expect(
    results.getByTestId('labs-summary-search-result-6690-2')
  ).toContainText('Low');
  await search.fill('Red Blood Cells');
  await expect(results).toHaveText('No  search results found');
  await search.fill('does not exist');
  await expect(results).toHaveText('No  search results found');
  await search.fill('   ');
  await expect(results).toHaveCount(0);
  await search.fill('');
  await expect(results).toHaveCount(0);
  await search.fill('718-7');
  await results.getByTestId('labs-summary-search-result-718-7').click();
  await expect(page).toHaveURL(/biomarker\/718-7$/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText(
    'Normal'
  );
});

test('Sort ranks latest biomarkers by absolute or signed relative deviation and clinical date', async ({
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
  await openRoute(page, '/');
  await expect(
    page
      .getByTestId('results-scroll-view')
      .getByRole('combobox', { name: 'Sort', exact: true })
  ).toHaveCount(0);
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  const sort = view.getByRole('combobox', { name: 'Sort', exact: true });
  const rows = view.getByRole('button', { name: /^View biomarker:/ });
  await expect(view.getByTestId('labs-summary-date-718-7')).toHaveText(
    'Oct 12, 2026'
  );
  await expect(view.getByTestId('labs-summary-date-6690-2')).toHaveText(
    'Oct 8, 2026'
  );
  await expect(view.getByTestId('labs-summary-date-789-8')).toHaveText(
    'Oct 1, 2020'
  );
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
  expect(periodBox.x).toBeCloseTo(rowBox.x, 0);
  const chartBox = (await view
    .getByTestId('labs-summary-chart')
    .boundingBox())!;
  const countsBox = (await view
    .getByTestId('labs-summary-status-counts')
    .boundingBox())!;
  expect(periodBox.y).toBeGreaterThan(chartBox.y + chartBox.height);
  expect(countsBox.y + countsBox.height / 2).toBeCloseTo(
    chartBox.y + chartBox.height / 2,
    0
  );
  expect(countsBox.x - (chartBox.x + chartBox.width)).toBeCloseTo(4, 0);
  const names = {
    wbc: 'White Blood Cells (WBC)',
    plt: 'Platelets (PLT)',
    hgb: 'Hemoglobin (Hgb)',
    rbc: 'Red Blood Cells (RBC)',
  };
  for (const [choice, order] of [
    ['deviation', ['wbc', 'plt', 'rbc', 'hgb']],
    ['lowest', ['wbc', 'hgb', 'rbc', 'plt']],
    ['highest', ['plt', 'rbc', 'hgb', 'wbc']],
    ['newest', ['hgb', 'plt', 'wbc', 'rbc']],
    ['oldest', ['rbc', 'wbc', 'plt', 'hgb']],
  ] as const) {
    await sort.selectOption(choice);
    await expect(rows).toHaveCount(4);
    for (const [index, key] of order.entries())
      await expect(rows.nth(index)).toContainText(names[key]);
    await expect(view.getByTestId('labs-summary-total')).toHaveText('4');
    await expect(view.getByTestId('labs-summary-result-718-7')).toContainText(
      '15.2'
    );
  }
  await view.getByRole('combobox', { name: 'Period' }).selectOption('1');
  await expect(sort).toHaveValue('oldest');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(names.wbc);
  await expect(view.getByTestId('labs-summary-result-789-8')).toHaveCount(0);
  await sort.selectOption('deviation');
  await expect(rows.nth(0)).toContainText(names.wbc);
  await expect(rows.nth(1)).toContainText(names.plt);
});
