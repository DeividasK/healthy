import {
  test,
  expect,
  checkA11y,
  evaluateBridge as bridge,
  getBrowserLocalDate,
  getTestTreatmentLog,
  seedTestBundle,
  seedTestPatient,
  seedTestResources,
  openRoute,
} from '@/src/features/testing/testStorage';
import type { RegimenDraft } from '@/src/features/treatments/regimen';

/** One phase of daily doses, each at a part of the day (e.g. MORN). */
const dailyAt = (...when: string[]): RegimenDraft => ({
  phases: [
    {
      doses: when.map((code) => ({
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
          when: code,
          boundsValue: '',
          boundsUnit: 'd',
        },
      })),
    },
  ],
});

test.describe('Treatment bundles', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('creates a bundle at a specific time from the journal', async ({
    page,
  }) => {
    const started = await getBrowserLocalDate(page, -3);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'b-vit-d',
          title: 'Vitamin D',
          status: 'active',
          takingSince: started,
        },
        {
          id: 'b-omega',
          title: 'Omega-3',
          status: 'active',
          takingSince: started,
        },
        { id: 'b-iron', title: 'Iron', status: 'active', takingSince: started },
      ],
    });
    await openRoute(page, '/journal');
    await expect(page.getByTestId('treatment-log-row-b-iron')).toBeVisible();
    await page.getByTestId('actions-new-bundle-button').click();
    await expect(page).toHaveURL(/\/bundle\/add$/);

    // Name and treatments are required.
    await page.getByTestId('save-bundle-button').click();
    await expect(page.getByTestId('bundle-form-error')).toHaveText(
      'Bundle name is required'
    );
    await page.getByTestId('bundle-title-input').fill('Before breakfast');
    for (const id of ['b-vit-d', 'b-omega']) {
      await page.getByTestId('bundle-treatment-search-input').click();
      await page
        .getByTestId(`bundle-treatment-autocomplete-item-${id}`)
        .click();
    }
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-bundle-times').click();
    await page
      .getByTestId('bundle-time-1-select')
      .selectOption({ label: 'At a specific time' });
    await page.locator('#bundle-time-1-input').fill('07:30');
    await checkA11y(page);
    await page.getByTestId('save-bundle-button').click();

    await expect(page).toHaveURL(/\/bundle\/bundle-/);
    await expect(page.getByTestId('bundle-title')).toHaveText(
      'Before breakfast'
    );
    await expect(page.getByTestId('bundle-times')).toHaveText('07:30');
    await expect(page.getByTestId('bundle-treatment-count')).toHaveText(
      '2 treatments'
    );
    await expect(page.getByTestId('bundle-treatment-b-omega')).toBeVisible();

    // Stored as a FHIR R5 RequestOrchestration: bundle → time → treatments.
    const id = page.url().split('/bundle/')[1];
    const stored = await bridge(
      page,
      (b, bundleId) => b.getBundle(bundleId),
      id
    );
    expect(stored).toMatchObject({
      resourceType: 'RequestOrchestration',
      status: 'active',
      intent: 'plan',
      action: [
        {
          title: 'Before breakfast',
          groupingBehavior: 'visual-group',
          action: [
            {
              timingTiming: { repeat: { timeOfDay: ['07:30:00'] } },
              action: [
                { resource: { reference: 'MedicationRequest/b-vit-d' } },
                { resource: { reference: 'MedicationRequest/b-omega' } },
              ],
            },
          ],
        },
      ],
    });

    // The treatment page lists its bundles.
    await page.getByTestId('bundle-treatment-b-vit-d').click();
    await expect(page.getByTestId(`treatment-bundle-${id}`)).toBeVisible();
  });

  test('answers a bundle at once, or its treatments one by one', async ({
    page,
  }) => {
    const today = await getBrowserLocalDate(page);
    const started = await getBrowserLocalDate(page, -3);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'j-vit-d',
          title: 'Vitamin D',
          status: 'active',
          takingSince: started,
        },
        {
          id: 'j-omega',
          title: 'Omega-3',
          status: 'active',
          takingSince: started,
        },
        { id: 'j-iron', title: 'Iron', status: 'active', takingSince: started },
      ],
    });
    const bundle = await seedTestBundle(page, {
      title: 'Morning supplements',
      times: ['MORN'],
      memberIds: ['j-vit-d', 'j-omega'],
    });
    const key = `${bundle.id}:0`;
    await openRoute(page, '/journal');

    const row = page.getByTestId(`bundle-log-row-${key}`);
    await expect(row).toContainText('Morning supplements');
    await expect(page.getByTestId(`bundle-log-count-${key}`)).toHaveText(
      '2 treatments'
    );
    // Treatments outside the bundle stay their own rows; members are folded.
    await expect(page.getByTestId('treatment-log-row-j-iron')).toBeVisible();
    await expect(page.getByTestId('treatment-log-row-j-vit-d')).toHaveCount(0);
    await checkA11y(page);

    const takenAll = page.getByTestId(`bundle-log-taken-${key}`);
    await takenAll.click();
    await expect(takenAll).toHaveAttribute('aria-checked', 'true');
    for (const id of ['j-vit-d', 'j-omega'])
      await expect
        .poll(() => getTestTreatmentLog(page, `${id}-${today}`))
        .toMatchObject({ status: 'completed' });
    await expect
      .poll(() => getTestTreatmentLog(page, `j-iron-${today}`))
      .toBeNull();

    // Partial intake: open the bundle and answer one treatment. Answered
    // both ways, the bundle's buttons are both tinted.
    await page.getByTestId(`bundle-log-toggle-${key}`).click();
    await page.getByTestId('treatment-log-not-taken-j-omega').click();
    await expect(takenAll).toHaveAttribute('aria-checked', 'mixed');
    await expect(
      page.getByTestId(`bundle-log-not-taken-${key}`)
    ).toHaveAttribute('aria-checked', 'mixed');
    await expect(page.getByTestId(`bundle-log-progress-${key}`)).toHaveText(
      '1 of 2 taken'
    );

    // Moving between days, the bundle starts closed, even answered in part.
    await page.getByTestId('actions-previous-day').click();
    await page.getByTestId('actions-next-day').click();
    await expect(page.getByTestId(`bundle-log-progress-${key}`)).toHaveText(
      '1 of 2 taken'
    );
    await expect(page.getByTestId(`bundle-log-members-${key}`)).toHaveCount(0);
    await expect(page.getByTestId(`bundle-log-toggle-${key}`)).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await page.getByTestId(`bundle-log-toggle-${key}`).click();

    // Bundle ✓ replaces every answer; pressing it again clears them.
    await takenAll.click();
    await expect(
      page.getByTestId('treatment-log-taken-j-omega')
    ).toHaveAttribute('aria-checked', 'true');
    await takenAll.click();
    await expect(takenAll).toHaveAttribute('aria-checked', 'false');
    await expect
      .poll(() => getTestTreatmentLog(page, `j-vit-d-${today}`))
      .toBeNull();

    // The row opens the bundle.
    await row.getByRole('button', { name: /View bundle/ }).click();
    await expect(page.getByTestId('bundle-title')).toHaveText(
      'Morning supplements'
    );
  });

  test('groups doses by time and follows the times of day settings', async ({
    page,
  }) => {
    const started = await getBrowserLocalDate(page, -3);
    await seedTestResources(page, {
      treatments: [
        {
          id: 't-magnesium',
          title: 'Magnesium',
          status: 'active',
          takingSince: started,
          regimen: dailyAt('MORN', 'EVE'),
        },
        {
          id: 't-zinc',
          title: 'Zinc',
          status: 'active',
          takingSince: started,
          regimen: dailyAt('MORN', 'EVE'),
        },
      ],
    });
    const bundle = await seedTestBundle(page, {
      title: 'Morning and night',
      times: ['07:30', 'EVE'],
      memberIds: ['t-magnesium', 't-zinc'],
    });
    await openRoute(page, '/journal');

    // Evening doses join the Evening time; morning doses are at 08:00, not
    // 07:30, so they stay their own rows.
    const evening = page
      .getByTestId('actions-group-EVE')
      .getByTestId(`bundle-log-row-${bundle.id}:1`);
    await expect(evening).toBeVisible();
    await expect(page.getByTestId(`bundle-log-row-${bundle.id}:0`)).toHaveCount(
      0
    );
    await expect(
      page.getByTestId('treatment-log-row-t-magnesium-0')
    ).toBeVisible();

    // Moving Morning to 07:30 brings the morning doses into the bundle.
    await page.getByTestId('settings-header-button').click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.locator('#settings-time-MORN').fill('07:30');
    await expect(page.getByTestId('settings-time-MORN')).toContainText('07:30');
    await page.getByTestId('save-settings-button').click();
    // Saving returns to the journal.
    await expect(page).toHaveURL(/\/journal$/);
    await expect(
      page
        .getByTestId('actions-group-07:30')
        .getByTestId(`bundle-log-row-${bundle.id}:0`)
    ).toBeVisible();
    await expect(
      page.getByTestId('treatment-log-row-t-magnesium-0')
    ).toHaveCount(0);
  });

  test('links bundles from the treatment form and cleans up on delete', async ({
    page,
  }) => {
    const started = await getBrowserLocalDate(page, -3);
    await seedTestResources(page, {
      treatments: [
        {
          id: 'l-vit-d',
          title: 'Vitamin D',
          status: 'active',
          takingSince: started,
        },
        {
          id: 'l-omega',
          title: 'Omega-3',
          status: 'active',
          takingSince: started,
        },
      ],
    });
    const bundle = await seedTestBundle(page, {
      title: 'Daily',
      memberIds: ['l-vit-d'],
    });

    await openRoute(page, '/treatment/l-omega/edit');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-bundle').click();
    await page.getByTestId('link-bundle-search-input').click();
    await page
      .getByTestId(`link-bundle-autocomplete-item-${bundle.id}`)
      .click();
    await page.getByTestId('save-treatment-button').click();
    await expect(
      page.getByTestId(`treatment-bundle-${bundle.id}`)
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await bridge(page, (b, id) => b.getBundle(id), bundle.id)).action[0]
            .action[0].action.length
      )
      .toBe(2);

    // Deleting a treatment removes it from its bundles; an emptied bundle goes.
    for (const id of ['l-vit-d', 'l-omega'])
      await bridge(
        page,
        (b, treatmentId) => b.deleteTreatment(treatmentId),
        id
      );
    await expect
      .poll(() => bridge(page, (b, id) => b.getBundle(id), bundle.id))
      .toBeNull();
  });
});
