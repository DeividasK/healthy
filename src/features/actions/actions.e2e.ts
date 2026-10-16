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
      page.getByTestId(`home-action-day-${today}-incomplete`)
    ).toBeVisible();

    await page.getByTestId('home-actions-open').click();
    await expect(page).toHaveURL(/\/actions$/);
    await expect(page.getByTestId('actions-heading')).toContainText(
      "What's happening today"
    );
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');
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
      page.getByTestId(`actions-day-${today}-incomplete`)
    ).toBeVisible();
    await expect
      .poll(() => getTestTreatmentLog(page, `log-vitamin-d-${today}`))
      .toBeNull();

    // Yesterday is logged from the previous-day arrow.
    await page.getByTestId('actions-previous-day').click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
    await expect(page.getByTestId('actions-day-label')).toHaveText('Yesterday');
    await expect(page.getByTestId('actions-heading')).toContainText(
      'What happened on'
    );
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
      page.getByTestId(`home-action-day-${today}-incomplete`)
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

    await page.goto(`/actions?date=${yesterday}`);
    // Yesterday lists the answered stopped treatment, not one started today.
    await expect(
      page.getByTestId('treatment-log-row-log-stopped')
    ).toBeVisible();
    await expect(page.getByTestId('treatment-log-row-log-new')).toHaveCount(0);

    await page.getByTestId('actions-next-day').click();
    await expect(page.getByTestId('treatment-log-row-log-new')).toBeVisible();
    await expect(page.getByTestId('treatment-log-row-log-stopped')).toHaveCount(
      0
    );

    // Future days cannot be logged.
    await page.goto('/actions?date=2999-01-01');
    await expect(page.getByTestId('actions-day-label')).toHaveText('Today');

    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.deleteTreatment('log-stopped')
    );
    expect(
      await getTestTreatmentLog(page, `log-stopped-${yesterday}`)
    ).toBeNull();
  });
});
