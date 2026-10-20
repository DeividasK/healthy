import {
  test,
  takeSnapshot,
  seedTestBundle,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';
import type { RegimenDraft } from '@/src/features/treatments/regimen';

// The visual fixture fixes today at 2026-10-08.

/** A once-daily regimen of one tablet at a part of the day. */
const onceDailyAt = (when: string): RegimenDraft => ({
  phases: [
    {
      doses: [
        {
          amount: '1',
          amountMax: '',
          unit: '{tablet}',
          route: '',
          site: '',
          patientInstruction: '',
          timing: {
            frequency: '1',
            frequencyMax: '',
            period: '1',
            periodUnit: 'd',
            when,
            boundsValue: '',
            boundsUnit: 'd',
          },
        },
      ],
    },
  ],
});

const treatments = [
  {
    id: 'visual-log-vitamin-d',
    title: 'Vitamin D 1000 IU',
    status: 'active' as const,
    authoredOn: '2026-09-20',
    takingSince: '2026-09-20',
  },
  {
    id: 'visual-log-iron',
    title: 'Ferrous sulfate 200mg',
    status: 'active' as const,
    authoredOn: '2026-09-20',
    takingSince: '2026-09-20',
  },
  {
    id: 'visual-log-cream',
    title: 'Hydrocortisone cream',
    status: 'active' as const,
    authoredOn: '2026-09-20',
    takingSince: '2026-09-20',
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
    await page.getByTestId('actions-day-label').click();
    await page.getByTestId('actions-calendar-day-2026-09-29').waitFor();
    await takeSnapshot(page, 'My actions - Month calendar', testInfo);
    await page.goto('/journal');
    await page.getByTestId('treatment-log-taken-visual-log-cream').waitFor();
    // Do not capture Expo's development error toast for this injected failure.
    await page.evaluate(() => {
      const report = console.error;
      console.error = (...args: unknown[]) => {
        if (args[0] !== 'Failed to save treatment log:') report(...args);
      };
    });
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        `CREATE TEMP TRIGGER fail_journal_insert BEFORE INSERT ON medication_administrations BEGIN SELECT RAISE(ABORT, 'Synthetic save failure'); END;`
      )
    );
    await page.getByTestId('treatment-log-taken-visual-log-cream').click();
    await page.getByTestId('actions-save-error').waitFor();
    await takeSnapshot(page, 'My actions - Answer save failed', testInfo);
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        'DROP TRIGGER fail_journal_insert;'
      )
    );
  });

  test('A bundle answered in part, opened', async ({ page }, testInfo) => {
    const bundle = await seedTestBundle(page, {
      title: 'Morning supplements',
      times: ['MORN'],
      memberIds: ['visual-log-vitamin-d', 'visual-log-iron'],
    });
    await page.goto('/journal');
    // Answers are mixed today, so the bundle opens on its treatments.
    await page.getByTestId(`bundle-log-members-${bundle.id}:0`).waitFor();
    await takeSnapshot(page, 'My actions - Bundle answered in part', testInfo);
  });

  test('Treatments grouped by time of day, then reordered', async ({
    page,
  }, testInfo) => {
    await seedTestResources(page, {
      treatments: [
        {
          id: 'visual-log-magnesium',
          title: 'Magnesium 250mg',
          status: 'active',
          authoredOn: '2026-09-20',
          takingSince: '2026-09-20',
          regimen: onceDailyAt('EVE'),
        },
        {
          id: 'visual-log-omega',
          title: 'Omega-3',
          status: 'active',
          authoredOn: '2026-09-20',
          takingSince: '2026-09-20',
          regimen: onceDailyAt('MORN'),
        },
        {
          id: 'visual-log-probiotic',
          title: 'Probiotic',
          status: 'active',
          authoredOn: '2026-09-20',
          takingSince: '2026-09-20',
          regimen: onceDailyAt('MORN'),
        },
      ],
    });
    await page.goto('/journal');
    await page.getByTestId('actions-group-MORN').waitFor();
    await page
      .getByTestId('treatment-log-row-visual-log-magnesium-0')
      .waitFor();
    await takeSnapshot(page, 'My actions - Grouped by time of day', testInfo);

    await page.getByTestId('actions-reorder-button').click();
    await page.getByTestId('journal-move-up-visual-log-probiotic-0').waitFor();
    await takeSnapshot(page, 'My actions - Reordering', testInfo);
  });
});
