import {
  test,
  expect,
  checkA11y,
  getBrowserLocalDate,
  getTestTreatmentLog,
  seedTestPatient,
  seedTestResources,
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
        },
        {
          id: 'log-iron',
          title: 'Iron',
          status: 'active',
          authoredOn: started,
        },
      ],
    });
    await page.goto('/');

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
          regimen: {
            phases: [{ doses: [timedDose('MORN'), timedDose('EVE')] }],
          },
        },
      ],
    });
    await page.goto('/journal');

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
        { id: 'copy-a', title: 'A', status: 'active', authoredOn: started },
        { id: 'copy-b', title: 'B', status: 'active', authoredOn: started },
      ],
      treatmentLogs: [
        { treatmentId: 'copy-a', date: yesterday, answer: 'taken' },
        { treatmentId: 'copy-b', date: yesterday, answer: 'not-taken' },
      ],
    });
    await page.goto('/journal');
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

  test('pages through weeks by swiping, arrows and the date picker', async ({
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
        },
      ],
    });
    await page.goto('/journal');
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
    await page.goto(`/journal?date=${weekStart}`);
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

    // The day label opens a date picker for any earlier day.
    await page
      .getByTestId('actions-day-label')
      .locator('input[type="date"]')
      .fill(picked);
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
    await page.goto('/');
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
        },
      ],
      treatmentLogs: [
        { treatmentId: 'log-stopped', date: yesterday, answer: 'taken' },
      ],
    });
    await expect(page.getByTestId('home-actions-section')).toBeVisible();
    // Days with nothing to log show a cross.
    await expect(
      page.getByTestId(
        `home-action-day-${await getBrowserLocalDate(page, -2)}-none`
      )
    ).toBeVisible();

    await page.goto(`/journal?date=${yesterday}`);
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
    await page.goto('/journal?date=2999-01-01');
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');

    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.deleteTreatment('log-stopped')
    );
    expect(
      await getTestTreatmentLog(page, `log-stopped-${yesterday}`)
    ).toBeNull();
  });
});
