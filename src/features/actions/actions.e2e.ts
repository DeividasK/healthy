import type { Locator } from '@playwright/test';
import type { RegimenDraft } from '@/src/features/treatments/regimen';
import {
  test,
  expect,
  checkA11y,
  evaluateBridge,
  getBrowserLocalDate,
  getTestTreatmentLog,
  seedTestPatient,
  seedTestResources,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('My actions: treatment logging', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('logs treatments from the homepage for today and past days', async ({
    page,
  }) => {
    const today = await getBrowserLocalDate(page);
    const yesterday = await getBrowserLocalDate(page, -1);
    const started = await getBrowserLocalDate(page, -10);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'log-vitamin-d',
          title: 'Vitamin D',
          status: 'active',
          authoredOn: started,
          takingSince: started,
        },
        {
          id: 'log-iron',
          title: 'Iron',
          status: 'active',
          authoredOn: started,
          takingSince: started,
        },
      ],
    });
    await openRoute(page, '/');

    // The last 7 days, today last, are the first section on the homepage.
    const section = page.getByTestId('home-actions-section');
    await expect(section).toBeVisible();
    const days = section.locator('[data-testid^="home-action-day-"][role]');
    await expect(days).toHaveCount(7);
    await expect(days.last()).toHaveAttribute(
      'data-testid',
      `home-action-day-${today}`
    );
    await expect(
      page.getByTestId(`home-action-day-${today}-empty`)
    ).toBeVisible();

    await page.getByTestId('home-actions-open').click();
    await expect(page).toHaveURL(/\/journal$/);
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');
    // Yesterday has no answers, so there is nothing to copy.
    await expect(page.getByTestId('actions-copy-previous-day')).toHaveCount(0);
    await expect(page.getByTestId('actions-next-day')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await checkA11y(page);

    const takenVitaminD = page.getByTestId('treatment-log-taken-log-vitamin-d');
    await takenVitaminD.click();
    await page.getByTestId('treatment-log-not-taken-log-iron').click();
    await expect(takenVitaminD).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByTestId('treatment-log-not-taken-log-iron')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByTestId(`actions-day-${today}-complete`)
    ).toBeVisible();

    // Stored as one FHIR R5 MedicationAdministration per treatment and day.
    await expect
      .poll(() => getTestTreatmentLog(page, `log-iron-${today}`))
      .toMatchObject({
        resourceType: 'MedicationAdministration',
        status: 'not-done',
        occurenceDateTime: today,
        request: { reference: 'MedicationRequest/log-iron' },
        medication: { concept: { text: 'Iron' } },
      });

    // Pressing the selected answer again clears it.
    await takenVitaminD.click();
    await expect(takenVitaminD).toHaveAttribute('aria-checked', 'false');
    await expect(
      page.getByTestId(`actions-day-${today}-partial`)
    ).toBeVisible();
    await expect
      .poll(() => getTestTreatmentLog(page, `log-vitamin-d-${today}`))
      .toBeNull();

    // Yesterday is logged from the previous-day arrow.
    await page.getByTestId('actions-previous-day').click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
    await expect(page.getByTestId('actions-day-label')).toHaveText('Yesterday');
    await expect(takenVitaminD).toHaveAttribute('aria-checked', 'false');
    await takenVitaminD.click();
    await page.getByTestId('treatment-log-taken-log-iron').click();
    await expect(
      page.getByTestId(`actions-day-${yesterday}-complete`)
    ).toBeVisible();

    await page.getByTestId('actions-done-button').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByTestId(`home-action-day-${yesterday}-complete`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`home-action-day-${today}-partial`)
    ).toBeVisible();

    // A day on the homepage opens that day's answers.
    await page.getByTestId(`home-action-day-${yesterday}`).click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
    await expect(
      page.getByTestId('treatment-log-taken-log-iron')
    ).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('actions-next-day').click();
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');
  });

  test('logs each scheduled dose of a structured regimen separately', async ({
    page,
  }) => {
    const today = await getBrowserLocalDate(page);
    const timedDose = (when: string) => ({
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
    });
    await seedTestResources(page, {
      treatments: [
        {
          id: 'log-regimen',
          title: 'Metformin 500mg',
          status: 'active',
          authoredOn: await getBrowserLocalDate(page, -3),
          takingSince: await getBrowserLocalDate(page, -3),
          regimen: {
            phases: [{ doses: [timedDose('MORN'), timedDose('EVE')] }],
          },
        },
      ],
    });
    await openRoute(page, '/journal');

    const morning = page.getByTestId('treatment-log-row-log-regimen-0');
    const evening = page.getByTestId('treatment-log-row-log-regimen-1');
    await expect(morning).toContainText('1 tablet in the morning');
    await expect(evening).toContainText('1 tablet in the evening');

    await page.getByTestId('treatment-log-taken-log-regimen-0').click();
    await expect(
      page.getByTestId(`actions-day-${today}-partial`)
    ).toBeVisible();
    await page.getByTestId('treatment-log-not-taken-log-regimen-1').click();
    await expect(
      page.getByTestId(`actions-day-${today}-complete`)
    ).toBeVisible();

    await expect
      .poll(() => getTestTreatmentLog(page, `log-regimen-${today}-0`))
      .toMatchObject({
        status: 'completed',
        occurenceDateTime: today,
        request: { reference: 'MedicationRequest/log-regimen' },
        dosage: {
          text: '1 tablet in the morning',
          dose: { value: 1, code: '{tablet}' },
        },
      });
    await expect
      .poll(() => getTestTreatmentLog(page, `log-regimen-${today}-1`))
      .toMatchObject({ status: 'not-done' });
  });

  test("copies the previous day's answers and keeps them editable", async ({
    page,
  }) => {
    const today = await getBrowserLocalDate(page);
    const yesterday = await getBrowserLocalDate(page, -1);
    const started = await getBrowserLocalDate(page, -5);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'copy-a',
          title: 'A',
          status: 'active',
          authoredOn: started,
          takingSince: started,
        },
        {
          id: 'copy-b',
          title: 'B',
          status: 'active',
          authoredOn: started,
          takingSince: started,
        },
      ],
      treatmentLogs: [
        { treatmentId: 'copy-a', date: yesterday, answer: 'taken' },
        { treatmentId: 'copy-b', date: yesterday, answer: 'not-taken' },
      ],
    });
    await openRoute(page, '/journal');
    const copy = page.getByTestId('actions-copy-previous-day');
    await expect(copy).toHaveAttribute('aria-checked', 'false');

    await copy.click();
    await expect(copy).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByTestId('treatment-log-taken-copy-a')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByTestId('treatment-log-not-taken-copy-b')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByTestId(`actions-day-${today}-complete`)
    ).toBeVisible();

    // Copied answers stay editable; unchecking clears only unchanged copies.
    await page.getByTestId('treatment-log-not-taken-copy-a').click();
    await expect(
      page.getByTestId('treatment-log-not-taken-copy-a')
    ).toHaveAttribute('aria-checked', 'true');
    await copy.click();
    await expect(copy).toHaveAttribute('aria-checked', 'false');
    await expect(
      page.getByTestId('treatment-log-not-taken-copy-b')
    ).toHaveAttribute('aria-checked', 'false');
    await expect(
      page.getByTestId('treatment-log-not-taken-copy-a')
    ).toHaveAttribute('aria-checked', 'true');
    await expect
      .poll(() => getTestTreatmentLog(page, `copy-b-${today}`))
      .toBeNull();
    await expect(
      page.getByTestId(`actions-day-${today}-partial`)
    ).toBeVisible();
  });

  test('pages through weeks by swiping, arrows and the calendar', async ({
    page,
  }) => {
    const today = await getBrowserLocalDate(page);
    const weekStart = await getBrowserLocalDate(page, -6);
    const lastWeekEnd = await getBrowserLocalDate(page, -7);
    const lastWeekStart = await getBrowserLocalDate(page, -13);
    const picked = await getBrowserLocalDate(page, -40);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'page-active',
          title: 'Paged',
          status: 'active',
          authoredOn: await getBrowserLocalDate(page, -60),
          takingSince: await getBrowserLocalDate(page, -60),
        },
      ],
    });
    await openRoute(page, '/journal');
    await expect(page.getByTestId(`actions-day-${today}`)).toBeInViewport();
    await expect(page.getByTestId(`actions-day-${weekStart}`)).toBeInViewport();

    // Swiping shows the previous 7 days and keeps the selected day.
    const pager = page.getByTestId('actions-week-pager');
    await pager.evaluate((element) =>
      element.scrollBy({ left: -element.clientWidth })
    );
    await expect(
      page.getByTestId(`actions-day-${lastWeekEnd}`)
    ).toBeInViewport();
    await expect(
      page.getByTestId(`actions-day-${lastWeekStart}`)
    ).toBeInViewport();
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');

    // Stepping back past a week's first day turns to the week before.
    await openRoute(page, `/journal?date=${weekStart}`);
    await expect(page.getByTestId(`actions-day-${weekStart}`)).toBeInViewport();
    await page.getByTestId('actions-previous-day').click();
    await expect(page).toHaveURL(new RegExp(`date=${lastWeekEnd}`));
    await expect(
      page.getByTestId(`actions-day-${lastWeekEnd}`)
    ).toBeInViewport();
    await expect(
      page.getByTestId(`actions-day-${lastWeekEnd}`)
    ).toHaveAttribute('aria-checked', 'true');

    // The outline belongs to the day the arrows select.
    await page.getByTestId('actions-previous-day').click();
    const target = page.getByTestId(
      `actions-day-${await getBrowserLocalDate(page, -8)}`
    );
    await expect(target).toHaveAttribute('aria-checked', 'true');
    // The outline slides onto it.
    await expect
      .poll(async () => {
        const outline = (await page
          .getByTestId('actions-day-highlight')
          .boundingBox())!;
        return Math.abs(outline.x - (await target.boundingBox())!.x);
      })
      .toBeLessThanOrEqual(1);
    await expect
      .poll(async () => {
        const pager = (await page
          .getByTestId('actions-week-pager')
          .boundingBox())!;
        const pill = (await target.boundingBox())!;
        // Centred: 3 days on either side.
        return Math.abs(pill.x + pill.width / 2 - (pager.x + pager.width / 2));
      })
      .toBeLessThanOrEqual(1);

    // Centred, stepping back slides the strip: the new day takes its place.
    const centre = (await target.boundingBox())!.x;
    await page.getByTestId('actions-previous-day').click();
    await expect
      .poll(async () =>
        Math.abs(
          (await page
            .getByTestId(`actions-day-${await getBrowserLocalDate(page, -9)}`)
            .boundingBox())!.x - centre
        )
      )
      // Scroll offsets are whole pixels.
      .toBeLessThanOrEqual(1);

    // The day label now opens the journal's month calendar.
    await page.getByTestId('actions-day-label').click();
    await expect(page.getByTestId('actions-calendar')).toBeVisible();
    const selectedDate = await getBrowserLocalDate(page, -9);
    const monthIndex = (date: string) =>
      Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
    for (
      let month = monthIndex(selectedDate);
      month > monthIndex(picked);
      month--
    ) {
      await page.getByTestId('actions-calendar-previous-month').click();
    }
    await page.getByTestId(`actions-calendar-day-${picked}`).click();
    await expect(page.getByTestId('actions-calendar')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`date=${picked}`));
    await expect(page.getByTestId(`actions-day-${picked}`)).toBeInViewport();
    await expect(
      page.getByTestId('treatment-log-row-page-active')
    ).toBeVisible();
  });

  test('lists the treatments to log each day and removes logs with their treatment', async ({
    page,
  }) => {
    const today = await getBrowserLocalDate(page);
    const yesterday = await getBrowserLocalDate(page, -1);
    await seedTestResources(page, {
      treatments: [{ id: 'log-stopped', title: 'Stopped', status: 'stopped' }],
    });
    await openRoute(page, '/');
    await page.getByTestId('home-treatments-section').waitFor();
    // Nothing to log: no My actions section.
    await expect(page.getByTestId('home-actions-section')).toHaveCount(0);

    await seedTestResources(page, {
      treatments: [
        {
          id: 'log-new',
          title: 'Started today',
          status: 'active',
          authoredOn: today,
          takingSince: today,
        },
      ],
      treatmentLogs: [
        { treatmentId: 'log-stopped', date: yesterday, answer: 'taken' },
      ],
    });
    await expect(page.getByTestId('home-actions-section')).toBeVisible();
    // Days with nothing to log show a dot.
    await expect(
      page.getByTestId(
        `home-action-day-${await getBrowserLocalDate(page, -2)}-none`
      )
    ).toBeVisible();

    await openRoute(page, `/journal?date=${yesterday}`);
    // Yesterday lists the answered stopped treatment, not one started today.
    await expect(
      page.getByTestId(`treatment-log-row-log-stopped-${yesterday}`)
    ).toBeVisible();
    await expect(page.getByTestId('treatment-log-row-log-new')).toHaveCount(0);

    await page.getByTestId('actions-next-day').click();
    await expect(page.getByTestId('treatment-log-row-log-new')).toBeVisible();
    await expect(
      page.locator('[data-testid^="treatment-log-row-log-stopped"]')
    ).toHaveCount(0);

    // Future days cannot be logged.
    await openRoute(page, '/journal?date=2999-01-01');
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');

    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.deleteTreatment('log-stopped')
    );
    expect(
      await getTestTreatmentLog(page, `log-stopped-${yesterday}`)
    ).toBeNull();
  });
});

for (const mode of ['answer', 'copy'] as const) {
  test(`explains a failed journal ${mode} and allows retry after restoring the stored answer`, async ({
    page,
    consoleMonitor,
  }) => {
    await seedTestPatient(page);
    const today = await getBrowserLocalDate(page);
    const yesterday = await getBrowserLocalDate(page, -1);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'save-failure',
          title: 'Vitamin D',
          status: 'active',
          takingSince: yesterday,
        },
      ],
      treatmentLogs:
        mode === 'copy'
          ? [{ treatmentId: 'save-failure', date: yesterday, answer: 'taken' }]
          : [],
    });
    await openRoute(page, '/journal');
    const taken = page.getByTestId('treatment-log-taken-save-failure');
    await expect(taken).toBeVisible();
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        `CREATE TEMP TRIGGER fail_journal_insert BEFORE INSERT ON medication_administrations BEGIN SELECT RAISE(ABORT, 'Synthetic save failure'); END;`
      )
    );
    consoleMonitor.ignore(
      mode === 'copy'
        ? 'Failed to copy treatment logs:'
        : 'Failed to save treatment log:'
    );
    const action =
      mode === 'copy' ? page.getByTestId('actions-copy-previous-day') : taken;
    await action.click();
    await expect(page.getByTestId('actions-save-error')).toHaveText(
      mode === 'copy'
        ? 'Failed to copy treatment answers. Please try again.'
        : 'Failed to save treatment answer. Please try again.'
    );
    await expect(taken).toHaveAttribute('aria-checked', 'false');
    expect(await getTestTreatmentLog(page, `save-failure-${today}`)).toBeNull();
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        'DROP TRIGGER fail_journal_insert;'
      )
    );
    // Copy is a checkbox, so uncheck its failed optimistic state first.
    if (mode === 'copy') await action.click();
    await action.click();
    await expect(taken).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('actions-save-error')).toHaveCount(0);
    await expect
      .poll(() => getTestTreatmentLog(page, `save-failure-${today}`))
      .toMatchObject({ status: 'completed' });
  });
}

/** A once-daily regimen of one tablet at a part of the day or a clock time. */
const onceDailyAt = (at: string): RegimenDraft => ({
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
            when: /^\d/.test(at) ? '' : at,
            timeOfDay: /^\d/.test(at) ? at : '',
            boundsValue: '',
            boundsUnit: 'd',
          },
        },
      ],
    },
  ],
});

/** Test IDs of the journal rows in a section, top to bottom. */
const rowIds = (section: Locator) =>
  section
    .locator('[data-testid^="treatment-log-row-"]')
    .evaluateAll((rows) =>
      rows
        .map((row) => row.getAttribute('data-testid')!)
        .filter((id) => !id.endsWith('-open'))
    );

test.describe('My actions: journal organisation', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('groups treatments by time of day and keeps the order users give', async ({
    page,
  }) => {
    const started = await getBrowserLocalDate(page, -3);
    const treatment = (id: string, title: string, at?: string) => ({
      id,
      title,
      status: 'active' as const,
      authoredOn: started,
      takingSince: started,
      ...(at ? { regimen: onceDailyAt(at) } : {}),
    });
    await seedTestResources(page, {
      treatments: [
        treatment('org-iron', 'Iron', 'MORN'),
        treatment('org-magnesium', 'Magnesium', 'EVE'),
        treatment('org-vit-d', 'Vitamin D', 'MORN'),
        treatment('org-zinc', 'Zinc', '07:30'),
        treatment('org-cream', 'Hydrocortisone cream'),
      ],
    });
    await openRoute(page, '/journal');

    // Parts of the day in clock order; an exact time joins the nearest one,
    // and treatments without a time come last.
    const sections = page.locator('[data-testid^="actions-group-"]');
    await expect(sections).toHaveCount(3);
    expect(
      await sections.evaluateAll((all) =>
        all.map((section) => section.getAttribute('data-testid'))
      )
    ).toEqual(['actions-group-MORN', 'actions-group-EVE', 'actions-group-any']);
    const morning = page.getByTestId('actions-group-MORN');
    await expect(morning.getByRole('heading')).toHaveText('Morning');
    await expect(page.getByTestId('actions-group-any')).toContainText(
      'Any time'
    );
    await expect(
      page
        .getByTestId('actions-group-EVE')
        .getByTestId('treatment-log-row-org-magnesium-0')
    ).toBeVisible();
    await expect(
      page
        .getByTestId('actions-group-any')
        .getByTestId('treatment-log-row-org-cream')
    ).toBeVisible();
    // Within a part of the day, earlier times come first.
    const initial = await rowIds(morning);
    expect(initial).toHaveLength(3);
    expect(initial[0]).toBe('treatment-log-row-org-zinc-0');
    await checkA11y(page);

    // Reordering swaps answers for move buttons, within each part of the day.
    await page.getByTestId('actions-reorder-button').click();
    await expect(
      page.getByTestId('treatment-log-taken-org-zinc-0')
    ).toHaveCount(0);
    await expect(page.getByTestId('journal-move-up-org-zinc-0')).toBeDisabled();
    await expect(
      page.getByTestId('journal-move-down-org-magnesium-0')
    ).toBeDisabled();
    const last = initial[2].replace('treatment-log-row-', '');
    await page.getByTestId(`journal-move-up-${last}`).click();
    await page.getByTestId(`journal-move-up-${last}`).click();
    const moved = [initial[2], initial[0], initial[1]];
    await expect.poll(() => rowIds(morning)).toEqual(moved);
    await expect(page.getByTestId(`journal-move-up-${last}`)).toBeDisabled();
    await checkA11y(page);
    await page.getByTestId('actions-reorder-done-button').click();
    await expect(
      page.getByTestId('treatment-log-taken-org-zinc-0')
    ).toBeVisible();

    // The order is kept in the profile's settings, for every day.
    await expect
      .poll(
        async () =>
          (await evaluateBridge(page, (b) => b.getProfileSettings()))
            ?.journalOrder?.MORN
      )
      .toEqual(
        moved.map(
          (id) =>
            `MedicationRequest/${id.replace('treatment-log-row-', '').replace(/-0$/, '')}`
        )
      );
    await page.reload();
    await expect.poll(() => rowIds(morning)).toEqual(moved);
    await page.getByTestId('actions-previous-day').click();
    await expect.poll(() => rowIds(morning)).toEqual(moved);
  });
});
