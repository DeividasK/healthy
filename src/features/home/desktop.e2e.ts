import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  seedTestConsultation,
  openRoute,
  reopenRoute,
  restartApp,
  expandBiomarkerGroups,
} from '@/src/features/testing/testStorage';

// Desktop windows get the sidebar, side-by-side columns and keyboard
// shortcuts; phones keep the header and one column.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedTestPatient(page, { id: 'desktop-patient' });
});

const seedResults = (page: Parameters<typeof seedTestReport>[0]) =>
  seedTestReport(page, {
    date: '2026-10-10',
    // With the laboratory's ranges, as printed on the report.
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
      { name: 'Platelets', value: 250, referenceLow: 150, referenceHigh: 450 },
    ],
  });

test('the sidebar replaces the header and marks the current section', async ({
  page,
}) => {
  await openRoute(page, '/');
  const sidebar = page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(page.getByTestId('app-header')).toHaveCount(0);
  await expect(sidebar.getByTestId('profile-header-button')).toBeVisible();

  const nav = sidebar.getByRole('navigation', { name: 'Sections' });
  const home = nav.getByRole('link', { name: 'Home' });
  const biomarkers = nav.getByRole('link', { name: 'Biomarkers' });
  await expect(home).toHaveAttribute('aria-current', 'page');
  await expect(biomarkers).not.toHaveAttribute('aria-current', 'page');

  await biomarkers.click();
  await expect(page).toHaveURL(/labs-summary/);
  await expect(biomarkers).toHaveAttribute('aria-current', 'page');
  await expect(home).not.toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Treatments' }).click();
  await expect(page).toHaveURL(/treatments$/);
  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/settings$/);
  await home.click();
  await expect(page).toHaveURL(/\/$/);

  // The logo returns Home too.
  await biomarkers.click();
  await expect(page).toHaveURL(/labs-summary/);
  await sidebar.getByRole('link', { name: 'Healthy, go to Home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(home).toHaveAttribute('aria-current', 'page');
});

test('Home puts results beside conditions, and stacks them when one side is empty', async ({
  page,
}) => {
  await seedResults(page);
  await openRoute(page, '/');
  const scroll = page.getByTestId('results-scroll-view');
  const summary = scroll.getByTestId('labs-summary');
  await expect(summary).toBeVisible();
  // Results alone stay in one column.
  await expect(page.getByTestId('home-conditions-section')).toHaveCount(0);

  await seedTestCondition(page, { id: 'desktop-condition', title: 'Asthma' });
  await openRoute(page, '/');
  const condition = page.getByTestId('condition-card-desktop-condition');
  await expect(condition).toBeVisible();
  const summaryBox = (await summary.boundingBox())!;
  const conditionBox = (await condition.boundingBox())!;
  // Conditions sit to the right of the results, starting at the same height.
  expect(conditionBox.x).toBeGreaterThan(summaryBox.x + summaryBox.width);
  expect(Math.abs(conditionBox.y - summaryBox.y)).toBeLessThan(80);

  // The overview's filters work and are kept apart from the Biomarkers page's.
  await summary.getByTestId('labs-summary-filter-button').click();
  const filters = page.getByTestId('labs-summary-filters');
  await filters.getByRole('combobox', { name: 'Sort' }).selectOption('oldest');
  await filters.getByTestId('labs-summary-filters-done').click();
  const filterOn = { name: 'Filter latest results, filters on' };
  await expect(summary.getByRole('button', filterOn)).toBeVisible();
  const url = new URL(page.url());
  await restartApp(page, url.pathname + url.search);
  await expect(summary.getByRole('button', filterOn)).toBeVisible();
  await openRoute(page, '/labs-summary');
  await expect(
    page
      .getByTestId('labs-summary-view')
      .getByRole('button', { name: 'Filter latest results', exact: true })
  ).toBeVisible();
});

/** Records whether the loading skeleton shows from now on. */
const watchForSkeleton = (page: Parameters<typeof seedTestReport>[0]) =>
  page.evaluate(() => {
    const flags = window as unknown as { skeletonShown?: boolean };
    flags.skeletonShown = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="resource-skeleton"]'))
        flags.skeletonShown = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
const skeletonShown = (page: Parameters<typeof seedTestReport>[0]) =>
  page.evaluate(
    () => (window as unknown as { skeletonShown?: boolean }).skeletonShown
  );

test('the biomarkers list opens each biomarker beside it', async ({ page }) => {
  await seedResults(page);
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  // The first out-of-range result opens by default, its group open and
  // the others collapsed.
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    /^White Blood Cells/
  );
  const selected = view
    .getByRole('button', {
      name: /^View biomarker: White Blood Cells/,
    })
    .first();
  await expect(selected).toHaveAttribute('aria-current', 'true');
  const inRange = view.getByTestId('labs-summary-groups-inRange-toggle');
  await expect(inRange).toHaveAttribute('aria-expanded', 'false');
  // Arrow keys open a collapsed group on the way and land on its first row.
  await page.keyboard.press('ArrowDown');
  await expect(inRange).toHaveAttribute('aria-expanded', 'true');
  await expect(view.getByTestId('biomarker-title')).not.toHaveText(
    /^White Blood Cells/
  );
  await page.keyboard.press('ArrowUp');
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    /^White Blood Cells/
  );
  await expandBiomarkerGroups(view.getByTestId('labs-summary'));

  await view
    .getByRole('button', { name: 'View biomarker: Hemoglobin' })
    .first()
    .click();
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    'Hemoglobin (Hgb)'
  );
  await expect(page).toHaveURL(/labs-summary\?.*biomarker=/);
  await expect(selected).not.toHaveAttribute('aria-current', 'true');

  // Arrow keys move through the list, swapping the detail in place without
  // a loading skeleton; Hemoglobin is the last row.
  await watchForSkeleton(page);
  await page.keyboard.press('ArrowUp');
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    'Platelets (PLT)'
  );
  await page.keyboard.press('ArrowDown');
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    'Hemoglobin (Hgb)'
  );
  expect(await skeletonShown(page)).toBe(false);

  // The selection comes back from the URL when the screen remounts.
  await reopenRoute(page);
  await expect(
    page.getByTestId('labs-summary-view').getByTestId('biomarker-title')
  ).toHaveText('Hemoglobin (Hgb)');

  // A lab result opened from the list takes the arrow keys for its own
  // results, leaving the list's selection alone.
  await page
    .getByTestId('lab-results-list')
    .getByRole('button')
    .first()
    .click();
  await expect(page).toHaveURL(/lab-result\/[^/?]+$/);
  await expandBiomarkerGroups(page.getByTestId('lab-result-groups'));
  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(/lab-result\/[^/?]+\?biomarker=/);
  await page.getByTestId('back-button').click();
  await expect(
    page.getByTestId('labs-summary-view').getByTestId('biomarker-title')
  ).toHaveText('Hemoglobin (Hgb)');
});

test('a lab report shows its chosen biomarker beside its results', async ({
  page,
}) => {
  const { report } = await seedResults(page);
  await openRoute(page, `/lab-result/${report.id}`);
  const view = page.getByTestId('lab-result-view');
  const results = view.getByTestId('lab-result-results-section');
  // The first out-of-range result opens by default, beside the report.
  const detail = view.getByTestId('biomarker-view');
  await expect(detail.getByTestId('biomarker-title')).toHaveText(
    /^White Blood Cells/
  );
  expect((await detail.boundingBox())!.x).toBeGreaterThan(
    (await results.boundingBox())!.x + (await results.boundingBox())!.width
  );
  await expandBiomarkerGroups(results);
  await results
    .getByRole('button', { name: 'View biomarker: Hemoglobin' })
    .click();
  await expect(detail.getByTestId('biomarker-title')).toHaveText(
    'Hemoglobin (Hgb)'
  );
  await expect(page).toHaveURL(/\?biomarker=/);
  await expect(
    results.getByRole('button', { name: 'View biomarker: Hemoglobin' })
  ).toHaveAttribute('aria-current', 'true');
  await watchForSkeleton(page);
  await page.keyboard.press('ArrowUp');
  await expect(detail.getByTestId('biomarker-title')).not.toHaveText(
    'Hemoglobin (Hgb)'
  );
  expect(await skeletonShown(page)).toBe(false);
  // The report's own actions stay in the dock.
  await expect(page.getByTestId('edit-lab-result-button')).toBeVisible();
});

test('a biomarker page puts the chart and results beside the explanation', async ({
  page,
}) => {
  await seedResults(page);
  await openRoute(page, '/biomarker/718-7');
  const biomarker = page.getByTestId('biomarker-view');
  const latest = biomarker.getByTestId('biomarker-latest');
  await expect(latest).toBeVisible();
  await expect(page.getByTestId('app-sidebar')).toBeVisible();
  const latestBox = (await latest.boundingBox())!;
  // The page uses more than the 800px reading column.
  const viewBox = (await biomarker.boundingBox())!;
  expect(viewBox.width).toBeGreaterThan(800);
  expect(latestBox.x).toBeLessThan(viewBox.x + viewBox.width / 2);
});

test('a condition puts its timeline beside the details', async ({ page }) => {
  await seedTestCondition(page, {
    id: 'desktop-timeline-condition',
    title: 'Asthma',
    notes: 'Worse in spring.',
  });
  await openRoute(page, '/condition/desktop-timeline-condition');
  const view = page.getByTestId('condition-view');
  const notes = view.getByTestId('condition-notes');
  await expect(notes).toBeVisible();
  // Without a timeline the details keep one column.
  await expect(view.getByTestId('condition-timeline')).toHaveCount(0);

  await seedTestConsultation(page, {
    title: 'Allergy review',
    date: '2026-10-01',
    conditionIds: ['desktop-timeline-condition'],
  });
  await openRoute(page, '/condition/desktop-timeline-condition');
  const timeline = view.getByTestId('condition-timeline');
  await expect(timeline).toBeVisible();
  const notesBox = (await notes.boundingBox())!;
  const timelineBox = (await timeline.boundingBox())!;
  expect(timelineBox.x).toBeGreaterThan(notesBox.x + notesBox.width);
  expect(timelineBox.y).toBeLessThan(notesBox.y + notesBox.height);
});

test('keyboard shortcuts move between sections and open the shortcut list', async ({
  page,
}) => {
  await seedResults(page);
  await openRoute(page, '/');
  await expect(page.getByTestId('app-sidebar')).toBeVisible();

  const dialog = page.getByTestId('keyboard-shortcuts');
  // Retried until the shortcuts are listening after the first render.
  await expect(async () => {
    await page.keyboard.press('?');
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass();
  // Shortcuts wait while a dialog is open.
  await page.keyboard.press('g');
  await page.keyboard.press('s');
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('g');
  await page.keyboard.press('b');
  await expect(page).toHaveURL(/labs-summary/);
  await page.keyboard.press('g');
  await page.keyboard.press('t');
  await expect(page).toHaveURL(/treatments$/);
  await page.keyboard.press('g');
  await page.keyboard.press('j');
  await expect(page).toHaveURL(/journal$/);
  await page.keyboard.press('g');
  await page.keyboard.press('s');
  await expect(page).toHaveURL(/settings$/);
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/$/);

  // / searches the biomarkers, from anywhere.
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/labs-summary/);
  await expect(page.locator('#labs-summary-search')).toBeFocused();
  // Typing in the search box is not a shortcut.
  await page.keyboard.type('gh');
  await expect(page).toHaveURL(/labs-summary/);
  await page.locator('#labs-summary-search').blur();

  await page.keyboard.press('l');
  await expect(page).toHaveURL(/lab-result\/add$/);

  // The sidebar button opens the list too.
  await page.getByTestId('keyboard-shortcuts-button').click();
  await expect(dialog).toBeVisible();
});
