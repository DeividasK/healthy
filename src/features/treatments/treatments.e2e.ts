import {
  test,
  expect,
  checkA11y,
  seedTestPatient,
  seedTestResources,
  openRoute,
  useSingleColumnLayout,
} from '@/src/features/testing/testStorage';

const TREATMENTS = {
  taking: 'list-vitamin-d',
  'on-hold': 'list-magnesium',
  stopped: 'list-doxycycline',
  'not-started': 'list-ibuprofen',
};

// Listed newest first: Vitamin D, Magnesium, Doxycycline, Ibuprofen.
test.beforeEach(async ({ page }) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    treatments: [
      {
        id: TREATMENTS.taking,
        title: 'Vitamin D',
        authoredOn: '2026-01-04',
        takingSince: '2026-01-05',
      },
      {
        id: TREATMENTS['on-hold'],
        title: 'Magnesium',
        authoredOn: '2026-01-03',
      },
      {
        id: TREATMENTS.stopped,
        title: 'Doxycycline',
        authoredOn: '2026-01-02',
      },
      {
        id: TREATMENTS['not-started'],
        title: 'Ibuprofen',
        authoredOn: '2026-01-01',
      },
    ],
    treatmentUsage: [
      {
        treatmentId: TREATMENTS['on-hold'],
        action: 'start',
        date: '2026-01-05',
      },
      {
        treatmentId: TREATMENTS['on-hold'],
        action: 'pause',
        date: '2026-02-01',
      },
      { treatmentId: TREATMENTS.stopped, action: 'start', date: '2026-01-05' },
      { treatmentId: TREATMENTS.stopped, action: 'stop', date: '2026-01-20' },
    ],
  });
});

test('lists every treatment and filters them by current usage', async ({
  page,
}) => {
  await useSingleColumnLayout(page);
  await openRoute(page, '/');
  await page.getByTestId('home-treatments-open').click();
  await expect(page).toHaveURL(/\/treatments$/);
  const view = page.getByTestId('treatments-view');
  const rows = view.getByRole('button', { name: /^View treatment: / });
  await expect(rows).toHaveCount(4);
  await expect(view.getByTestId('treatments-list-count')).toHaveText('4');
  await expect(
    view.getByTestId(`treatments-usage-${TREATMENTS['on-hold']}`)
  ).toHaveText('On Hold');
  await checkA11y(page);

  const filterButton = view.getByTestId('treatments-filter-button');
  const chip = (usage: string) =>
    page.getByTestId(`treatments-filter-status-${usage}`);
  const closeFilters = () =>
    page.getByTestId('treatments-filters-done').click();

  for (const [usage, id] of Object.entries(TREATMENTS)) {
    await test.step(`shows only ${usage} treatments`, async () => {
      await filterButton.click();
      await page.getByTestId('treatments-filters-reset').click();
      await chip(usage).click();
      await expect(chip(usage)).toHaveAttribute('aria-checked', 'true');
      await closeFilters();
      await expect(rows).toHaveCount(1);
      await expect(view.getByTestId(`treatments-row-${id}`)).toBeVisible();
      await expect(filterButton).toHaveAccessibleName(
        'Filter treatments, filters on'
      );
    });
  }

  await test.step('combines statuses', async () => {
    await filterButton.click();
    await chip('taking').click();
    await closeFilters();
    await expect(rows).toHaveCount(2);
    await checkA11y(page);
    await expect(view.getByTestId('treatments-list')).toContainText(
      'Taking, Not started'
    );
  });

  await test.step('opens a treatment and keeps the filters on return', async () => {
    await view
      .getByTestId(`treatments-row-${TREATMENTS['not-started']}`)
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/treatment/${TREATMENTS['not-started']}$`)
    );
    await page.goBack();
    await expect(rows).toHaveCount(2);
  });

  await test.step('updates when usage changes and says when none match', async () => {
    await filterButton.click();
    await page.getByTestId('treatments-filters-reset').click();
    await chip('taking').click();
    await closeFilters();
    await expect(rows).toHaveCount(1);
    await seedTestResources(page, {
      treatmentUsage: [
        { treatmentId: TREATMENTS.taking, action: 'stop', date: '2026-02-01' },
      ],
    });
    await expect(view.getByTestId('treatments-no-matches')).toBeVisible();
    await expect(rows).toHaveCount(0);
  });

  await test.step('reset shows every treatment again', async () => {
    await filterButton.click();
    await page.getByTestId('treatments-filters-reset').click();
    await closeFilters();
    await expect(rows).toHaveCount(4);
    await expect(filterButton).toHaveAccessibleName('Filter treatments');
  });
});

test('desktop shows the chosen treatment beside the list', async ({ page }) => {
  await openRoute(page, '/treatments');
  const view = page.getByTestId('treatments-view');
  const row = (id: string) => view.getByTestId(`treatments-row-${id}`);
  const title = view.getByTestId('treatment-title');

  await test.step('starts with the first listed treatment', async () => {
    await expect(title).toHaveText('Vitamin D');
    await expect(row(TREATMENTS.taking)).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  await test.step('rows and arrow keys choose a treatment in place', async () => {
    await row(TREATMENTS.stopped).click();
    await expect(page).toHaveURL(
      new RegExp(`/treatments\\?treatment=${TREATMENTS.stopped}$`)
    );
    await expect(title).toHaveText('Doxycycline');
    await expect(row(TREATMENTS.stopped)).toHaveAttribute(
      'aria-current',
      'true'
    );
    await expect(row(TREATMENTS.taking)).not.toHaveAttribute(
      'aria-current',
      'true'
    );
    await page.keyboard.press('ArrowDown');
    await expect(title).toHaveText('Ibuprofen');
    await page.keyboard.press('ArrowUp');
    await expect(title).toHaveText('Doxycycline');
    await checkA11y(page);
  });

  await test.step('a filter that hides it shows the first match', async () => {
    await view.getByTestId('treatments-filter-button').click();
    await page.getByTestId('treatments-filter-status-on-hold').click();
    await page.getByTestId('treatments-filters-done').click();
    await expect(title).toHaveText('Magnesium');
    await view.getByTestId('treatments-filter-button').click();
    await page.getByTestId('treatments-filters-reset').click();
    await page.getByTestId('treatments-filters-done').click();
  });

  await test.step('deleting it stays on the list', async () => {
    await row(TREATMENTS['not-started']).click();
    await expect(title).toHaveText('Ibuprofen');
    await page.getByTestId('delete-treatment-button').click();
    await page.getByTestId('delete-modal-confirm-button').click();
    await expect(page).toHaveURL(/\/treatments$/);
    await expect(row(TREATMENTS['not-started'])).toHaveCount(0);
    await expect(title).toHaveText('Vitamin D');
  });

  await test.step('a filter that matches nothing keeps the layout and modal', async () => {
    await view.getByTestId('treatments-filter-button').click();
    await page.getByTestId('treatments-filter-status-not-started').click();
    await expect(view.getByTestId('treatments-no-matches')).toBeVisible();
    await expect(page.getByTestId('treatments-filters')).toBeVisible();
    await expect(
      page.getByTestId('treatments-filter-status-not-started')
    ).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('treatments-filters-done').click();
    await expect(title).toHaveCount(0);
    await expect(page.locator('#treatment-list')).toBeVisible();
  });
});
