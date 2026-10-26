import {
  test,
  expect,
  checkA11y,
  seedTestPatient,
  seedTestResources,
  openRoute,
} from '@/src/features/testing/testStorage';

const TREATMENTS = {
  taking: 'list-vitamin-d',
  'on-hold': 'list-magnesium',
  stopped: 'list-doxycycline',
  'not-started': 'list-ibuprofen',
};

test.beforeEach(async ({ page }) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    treatments: [
      {
        id: TREATMENTS.taking,
        title: 'Vitamin D',
        authoredOn: '2026-01-01',
        takingSince: '2026-01-05',
      },
      {
        id: TREATMENTS['on-hold'],
        title: 'Magnesium',
        authoredOn: '2026-01-01',
      },
      {
        id: TREATMENTS.stopped,
        title: 'Doxycycline',
        authoredOn: '2026-01-01',
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

  const status = view.getByRole('combobox', { name: 'Status' });
  for (const [usage, id] of Object.entries(TREATMENTS)) {
    await test.step(`shows only ${usage} treatments`, async () => {
      await status.selectOption(usage);
      await expect(rows).toHaveCount(1);
      await expect(view.getByTestId(`treatments-row-${id}`)).toBeVisible();
    });
  }

  await test.step('opens a treatment and keeps the filter on return', async () => {
    await view
      .getByTestId(`treatments-row-${TREATMENTS['not-started']}`)
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/treatment/${TREATMENTS['not-started']}$`)
    );
    await page.goBack();
    await expect(status).toHaveValue('not-started');
    await expect(rows).toHaveCount(1);
  });

  await test.step('updates when usage changes and says when none match', async () => {
    await status.selectOption('taking');
    await expect(rows).toHaveCount(1);
    await seedTestResources(page, {
      treatmentUsage: [
        { treatmentId: TREATMENTS.taking, action: 'stop', date: '2026-02-01' },
      ],
    });
    await expect(view.getByTestId('treatments-no-matches')).toBeVisible();
    await expect(rows).toHaveCount(0);
  });
});
