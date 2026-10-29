import {
  test,
  expect,
  checkA11y,
  getBrowserLocalDate,
  getTestProcedureLog,
  seedTestPatient,
  seedTestResources,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('Journal: scheduled procedures and activities', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('logs a daily activity with how long it took', async ({ page }) => {
    const today = await getBrowserLocalDate(page);
    const started = await getBrowserLocalDate(page, -5);
    await seedTestResources(page, {
      serviceRequests: [
        {
          id: 'reading',
          title: 'Reading a book',
          status: 'active',
          authoredOn: started,
          schedule: { period: 1, periodUnit: 'd', duration: 30 },
        },
      ],
    });
    await openRoute(page, '/journal');

    const section = page.getByTestId('actions-procedures-section');
    await expect(section).toContainText('Procedures & activities');
    await expect(
      page.getByTestId('procedure-log-planned-duration-reading')
    ).toHaveText('30 min, once a day');
    await checkA11y(page);

    // Done records the planned minutes, which can then be changed.
    await page.getByTestId('procedure-log-taken-reading').click();
    const input = page.getByTestId('procedure-log-duration-reading-input');
    await expect(input).toHaveValue('30');
    await expect(
      page.getByTestId('procedure-log-planned-duration-reading')
    ).toHaveCount(0);
    await page.getByTestId('procedure-log-duration-reading-more').click();
    await expect(input).toHaveValue('35');
    await expect
      .poll(
        async () =>
          (await getTestProcedureLog(page, `reading-${today}`))
            ?.occurrenceTiming
      )
      .toEqual({
        event: [today],
        repeat: { duration: 35, durationUnit: 'min' },
      });

    // Typed minutes are saved when typing ends.
    await input.fill('42');
    await input.press('Enter');
    await expect
      .poll(
        async () =>
          (await getTestProcedureLog(page, `reading-${today}`))
            ?.occurrenceTiming?.repeat?.duration
      )
      .toBe(42);

    const log = await getTestProcedureLog(page, `reading-${today}`);
    expect(log).toMatchObject({
      resourceType: 'Procedure',
      status: 'completed',
      code: { text: 'Reading a book' },
      basedOn: [{ reference: 'ServiceRequest/reading' }],
    });
    expect(log.occurrenceDateTime).toBeUndefined();

    // Not done hides the duration; clearing the answer deletes the log.
    await page.getByTestId('procedure-log-not-taken-reading').click();
    await expect(
      page.getByTestId('procedure-log-duration-reading')
    ).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await getTestProcedureLog(page, `reading-${today}`))?.status
      )
      .toBe('not-done');
    await page.getByTestId('procedure-log-not-taken-reading').click();
    await expect
      .poll(async () => await getTestProcedureLog(page, `reading-${today}`))
      .toBeNull();
  });

  test('asks for each session once its interval has passed', async ({
    page,
  }) => {
    const authored = await getBrowserLocalDate(page, -60);
    const firstSession = await getBrowserLocalDate(page, -30);
    const tooSoon = await getBrowserLocalDate(page, -20);
    await seedTestResources(page, {
      serviceRequests: [
        {
          id: 'prp',
          title: 'PRP injection',
          category: '71388002',
          status: 'active',
          authoredOn: authored,
          schedule: { period: 4, periodMax: 6, periodUnit: 'wk', count: 3 },
        },
      ],
      procedureLogs: [
        { serviceRequestId: 'prp', date: firstSession, answer: 'taken' },
      ],
    });

    // Within 4 weeks of the first session, the next one is not asked for.
    await openRoute(page, `/journal?date=${tooSoon}`);
    await expect(page.getByTestId('actions-view')).toBeVisible();
    await expect(page.getByTestId('procedure-log-row-prp')).toHaveCount(0);

    await openRoute(page, '/journal');
    await expect(page.getByTestId('procedure-log-session-prp')).toHaveText(
      'Session 2 of 3'
    );
    await expect(page.getByTestId('procedure-log-due-prp')).toContainText(
      'Due'
    );
    await page.getByTestId('procedure-log-taken-prp').click();
    await expect(page.getByTestId('procedure-log-taken-prp')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // The service request lists its sessions; each opens its journal day.
    await openRoute(page, '/service-request/prp');
    const sessions = page.getByTestId('service-request-sessions-section');
    await expect(sessions).toContainText('Sessions');
    await expect(page.getByTestId('service-request-session-2')).toBeVisible();
    await expect(page.getByTestId('service-request-session-1')).toBeVisible();
    await expect(page.getByTestId('service-request-schedule')).toHaveText(
      '3 sessions, every 4–6 weeks'
    );
    await page.getByTestId('service-request-session-1').click();
    await expect(page).toHaveURL(new RegExp(`date=${firstSession}`));
  });

  test('lists sessions with no interval every day until all are done, without asking for them', async ({
    page,
  }) => {
    const authored = await getBrowserLocalDate(page, -10);
    const yesterday = await getBrowserLocalDate(page, -1);
    const today = await getBrowserLocalDate(page);
    await seedTestResources(page, {
      serviceRequests: [
        {
          id: 'physio',
          title: 'Individual physiotherapy',
          category: '71388002',
          status: 'active',
          authoredOn: authored,
          schedule: { count: 2, duration: 45 },
        },
      ],
      procedureLogs: [
        { serviceRequestId: 'physio', date: yesterday, answer: 'taken' },
      ],
    });

    await openRoute(page, '/');
    // Listed, but a day without a session is not left partly logged.
    await expect(
      page.getByTestId(`home-action-day-${today}`)
    ).toHaveAccessibleName(/Nothing to log$/);
    await openRoute(page, '/journal');
    await expect(page.getByTestId('procedure-log-session-physio')).toHaveText(
      'Session 2 of 2'
    );
    await expect(page.getByTestId('procedure-log-due-physio')).toHaveCount(0);
    await page.getByTestId('procedure-log-taken-physio').click();
    await expect(
      page.getByTestId('procedure-log-taken-physio')
    ).toHaveAttribute('aria-checked', 'true');

    await openRoute(page, '/service-request/physio');
    await expect(page.getByTestId('service-request-schedule')).toHaveText(
      '2 sessions'
    );
    await expect(page.getByTestId('service-request-session-2')).toBeVisible();
  });
});
