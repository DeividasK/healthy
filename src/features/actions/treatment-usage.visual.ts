import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/visualTest';

test('Usage form: start, stop with notes, resume', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    treatments: [
      {
        id: 'visual-usage',
        title: 'Vitamin D',
        status: 'active',
        dosageInstructions: '1 capsule daily with food',
      },
    ],
  });
  await page.goto('/treatment/visual-usage');
  await page.getByTestId('treatment-usage-start').click();
  await page.getByTestId('save-usage-button').waitFor();
  await takeSnapshot(page, 'Treatment usage - Start taking', testInfo);
  // A supplement without a prescription opens on an empty regimen.
  await seedTestResources(page, {
    treatments: [
      { id: 'visual-supplement', title: 'Magnesium', status: 'active' },
    ],
  });
  await page.goto('/treatment/visual-supplement');
  await page.getByTestId('treatment-usage-start').click();
  await page.getByTestId('treatment-regimen-field').waitFor();
  await takeSnapshot(
    page,
    'Treatment usage - Start taking without a prescription',
    testInfo
  );
  await seedTestResources(page, {
    treatmentUsage: [
      { treatmentId: 'visual-usage', action: 'start', date: '2026-10-01' },
    ],
  });
  await page.goto('/treatment/visual-usage');
  await page.getByTestId('treatment-usage-change').click();
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-usage-notes').click();
  await page
    .getByTestId('treatment-usage-notes-input')
    .fill('Waiting for a refill');
  await takeSnapshot(page, 'Treatment usage - On hold with notes', testInfo);
  await page.getByTestId('treatment-usage-kind-stop').click();
  await takeSnapshot(page, 'Treatment usage - Stopped selection', testInfo);
  await seedTestResources(page, {
    treatmentUsage: [
      {
        treatmentId: 'visual-usage',
        action: 'pause',
        date: '2026-10-06',
        notes: 'Waiting for a refill',
      },
    ],
  });
  await page.goto('/treatment/visual-usage');
  await page.getByTestId('treatment-usage-start').click();
  await page.getByTestId('save-usage-button').waitFor();
  await takeSnapshot(page, 'Treatment usage - Resume taking', testInfo);
});

test('Usage form: a new regimen and where it shows', async ({
  page,
}, testInfo) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    treatments: [
      {
        id: 'visual-regimen',
        title: 'Prednisolone 5mg',
        status: 'active',
        intent: 'order',
        authoredOn: '2026-09-28',
        takingSince: '2026-09-28',
        regimen: {
          phases: [
            {
              doses: [
                {
                  amount: '2',
                  amountMax: '',
                  unit: '{tablet}',
                  route: '26643006',
                  site: '',
                  patientInstruction: '',
                  timing: {
                    frequency: '1',
                    frequencyMax: '',
                    period: '1',
                    periodUnit: 'd',
                    when: 'MORN',
                    boundsValue: '',
                    boundsUnit: 'd',
                  },
                },
              ],
            },
          ],
        },
      },
    ],
    treatmentLogs: [
      {
        treatmentId: 'visual-regimen',
        date: '2026-10-06',
        answer: 'taken',
        doseIndex: 0,
      },
    ],
  });
  await page.goto('/treatment/visual-regimen');
  await page.getByTestId('treatment-usage-change').click();
  await page.getByTestId('save-usage-button').waitFor();
  await takeSnapshot(page, 'Treatment usage - Change usage', testInfo);
  await page.getByTestId('treatment-usage-kind-change').click();
  await page
    .getByTestId('treatment-usage-date-picker')
    .locator('input')
    .fill('2026-10-05');
  await page.getByLabel('Min Amount').fill('1');
  await takeSnapshot(page, 'Treatment usage - New regimen', testInfo);
  await page.getByTestId('save-usage-button').click();
  await page.getByTestId('treatment-current-regimen').waitFor();
  await page
    .getByTestId(/^treatment-usage-period-/)
    .nth(1)
    .waitFor();
  await takeSnapshot(page, 'Treatment View - New regimen', testInfo);
  await page.goto('/journal?date=2026-10-06');
  await page.getByTestId('treatment-log-mismatch-visual-regimen-0').waitFor();
  await takeSnapshot(
    page,
    'My actions - Answer under another regimen',
    testInfo
  );
});

test('Usage form: edit and remove a period', async ({ page }, testInfo) => {
  await seedTestPatient(page);
  await seedTestResources(page, {
    treatments: [
      {
        id: 'visual-edit',
        title: 'Vitamin D',
        status: 'active',
        dosageInstructions: '1 capsule daily with food',
      },
    ],
    treatmentUsage: [
      { treatmentId: 'visual-edit', action: 'start', date: '2026-10-01' },
      {
        treatmentId: 'visual-edit',
        action: 'pause',
        date: '2026-10-04',
        notes: 'Waiting for a refill',
      },
      { treatmentId: 'visual-edit', action: 'resume', date: '2026-10-07' },
    ],
  });
  await page.goto('/treatment/visual-edit');
  await page.getByRole('button', { name: /^Edit On hold/i }).click();
  await page.getByTestId('treatment-usage-notes-input').waitFor();
  await takeSnapshot(page, 'Treatment usage - Edit period', testInfo);
  await page.getByTestId('treatment-usage-state-taking').click();
  await page.getByTestId('treatment-usage-instructions-input').waitFor();
  await takeSnapshot(page, 'Treatment usage - Edit period as taking', testInfo);
  await page.getByTestId('treatment-usage-remove-button').click();
  await page.getByTestId('treatment-usage-remove-dialog').waitFor();
  await takeSnapshot(page, 'Treatment usage - Remove period', testInfo);
  // Do not capture Expo's development error toast for this injected failure.
  await page.evaluate(() => {
    const report = console.error;
    console.error = (...args: unknown[]) => {
      if (args[0] !== 'Failed to remove treatment usage:') report(...args);
    };
  });
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
      `CREATE TEMP TRIGGER fail_usage_delete BEFORE DELETE ON medication_statements BEGIN SELECT RAISE(ABORT, 'Synthetic removal failure'); END;`
    )
  );
  await page.getByTestId('delete-modal-confirm-button').click();
  await page.getByTestId('treatment-usage-remove-error').waitFor();
  await takeSnapshot(page, 'Treatment usage - Period removal failed', testInfo);
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
      'DROP TRIGGER fail_usage_delete;'
    )
  );
});
