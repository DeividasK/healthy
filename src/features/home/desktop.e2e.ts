import {
  test,
  expect,
  seedTestPatient,
  seedTestReport,
  seedTestCondition,
  openRoute,
} from '@/src/features/testing/testStorage';

// Desktop windows get the sidebar, side-by-side columns and keyboard
// shortcuts; phones keep the header and one column.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'));
  await seedTestPatient(page, { id: 'desktop-patient' });
});

const seedResults = (page: Parameters<typeof seedTestReport>[0]) =>
  seedTestReport(page, {
    date: '2026-10-10',
    biomarkers: [
      { name: 'Hemoglobin', value: 15.2 },
      { name: 'White Blood Cells', value: 3.1 },
      { name: 'Platelets', value: 250 },
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

  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/settings$/);
  await home.click();
  await expect(page).toHaveURL(/\/$/);
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
});

test('the biomarkers list opens each biomarker beside it', async ({ page }) => {
  await seedResults(page);
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  // The first out-of-range result opens by default.
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    /^White Blood Cells/
  );
  const selected = view
    .getByRole('button', {
      name: /^View biomarker: White Blood Cells/,
    })
    .first();
  await expect(selected).toHaveAttribute('aria-current', 'true');

  await view
    .getByRole('button', { name: 'View biomarker: Hemoglobin' })
    .first()
    .click();
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    'Hemoglobin (Hgb)'
  );
  await expect(page).toHaveURL(/labs-summary\?.*biomarker=/);
  await expect(selected).not.toHaveAttribute('aria-current', 'true');

  // Arrow keys move through the list; Hemoglobin is the last row.
  await page.keyboard.press('ArrowUp');
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    'Platelets (PLT)'
  );
  await page.keyboard.press('ArrowDown');
  await expect(view.getByTestId('biomarker-title')).toHaveText(
    'Hemoglobin (Hgb)'
  );

  // The selection survives a reload.
  await page.reload();
  await expect(
    page.getByTestId('labs-summary-view').getByTestId('biomarker-title')
  ).toHaveText('Hemoglobin (Hgb)');
});

test('a biomarker page puts the chart and results beside the explanation', async ({
  page,
}) => {
  await seedResults(page);
  await openRoute(page, '/labs-summary');
  const view = page.getByTestId('labs-summary-view');
  await view
    .getByRole('button', { name: 'View biomarker: Hemoglobin' })
    .first()
    .click();
  const url = new URL(page.url());
  const id = url.searchParams.get('biomarker');
  await openRoute(page, `/biomarker/${id}`);
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
