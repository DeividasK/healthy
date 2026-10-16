import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';

// The visual fixture fixes today at 2026-10-08.
const treatments = [
  {
    id: 'visual-log-vitamin-d',
    title: 'Vitamin D 1000 IU',
    status: 'active' as const,
    authoredOn: '2026-09-20',
  },
  {
    id: 'visual-log-iron',
    title: 'Ferrous sulfate 200mg',
    status: 'active' as const,
    authoredOn: '2026-09-20',
  },
  {
    id: 'visual-log-cream',
    title: 'Hydrocortisone cream',
    status: 'active' as const,
    authoredOn: '2026-09-20',
  },
];
const fullDay = (date: string) =>
  treatments.map(({ id }) => ({
    treatmentId: id,
    date,
    answer: 'taken' as const,
  }));
const treatmentLogs = [
  ...['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-06'].flatMap(fullDay),
  {
    treatmentId: 'visual-log-iron',
    date: '2026-10-05',
    answer: 'not-taken' as const,
  },
  {
    treatmentId: 'visual-log-vitamin-d',
    date: '2026-10-08',
    answer: 'taken' as const,
  },
  {
    treatmentId: 'visual-log-iron',
    date: '2026-10-08',
    answer: 'not-taken' as const,
  },
];

test.describe('My actions - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
    await seedTestResources(page, { treatments, treatmentLogs });
  });

  test('Home and actions view with a partly logged week', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('home-action-day-2026-10-06-complete').waitFor();
    await takeSnapshot(page, 'My actions - Home week strip', testInfo);

    await page.getByTestId('home-actions-open').click();
    await page
      .getByTestId('treatment-log-row-visual-log-cream')
      .waitFor({ state: 'visible' });
    await takeSnapshot(page, 'My actions - Today', testInfo);

    // The fixture's frozen clock stops slide animations, so other days
    // open directly.
    await page.goto('/journal?date=2026-10-05');
    await page
      .getByTestId('actions-day-label')
      .getByText('Mon, Oct 5')
      .waitFor();
    await page.getByTestId('treatment-log-row-visual-log-cream').waitFor();
    await takeSnapshot(page, 'My actions - Past day', testInfo);

    // An older day sits in the middle of the strip (Sep 26 – Oct 2).
    await page.goto('/journal?date=2026-09-29');
    await page.getByTestId('actions-day-2026-09-26').waitFor();
    await page.getByTestId('treatment-log-row-visual-log-cream').waitFor();
    await takeSnapshot(page, 'My actions - Centred older day', testInfo);
  });
});
