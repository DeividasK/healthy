import type { Page } from '@playwright/test';
import {
  test,
  expect,
  checkA11y,
  getBrowserLocalDate,
  getTestTreatment,
  getTestTreatmentLog,
  getTestTreatmentUsage,
  seedTestPatient,
  seedTestResources,
  openRoute,
  reopenRoute,
} from '@/src/features/testing/testStorage';

const treatmentId = 'usage-treatment';
const viewUrl = `/treatment/${treatmentId}`;

async function saveChange(page: Page, date: string, url = viewUrl) {
  await page
    .getByTestId('treatment-usage-date-picker')
    .locator('input')
    .fill(date);
  await page.getByTestId('save-usage-button').click();
  await expect(page).toHaveURL(new RegExp(`${url}$`));
}

/** Opens a period's edit form from the treatment page. */
async function editPeriod(page: Page, statementId: string) {
  await page.getByTestId(`treatment-usage-edit-${statementId}`).click();
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    /^Edit usage: /
  );
}

/** Removes a period from its edit form, after confirming. */
async function removePeriod(page: Page, statementId: string) {
  await editPeriod(page, statementId);
  await page.getByTestId('treatment-usage-remove-button').click();
  await page.getByTestId('delete-modal-confirm-button').click();
  await expect(page).toHaveURL(new RegExp(`${viewUrl}$`));
}

test.beforeEach(async ({ page }) => {
  await seedTestPatient(page, { id: 'usage-patient' });
  await seedTestResources(page, {
    treatments: [{ id: treatmentId, title: 'Vitamin D', status: 'active' }],
  });
});

test('start, pause, resume and stop persist FHIR periods and only ask on taking days', async ({
  page,
}) => {
  // Opens the journal on each of seven days, a full app load each time.
  test.setTimeout(60_000);
  await seedTestResources(page, {
    treatments: [
      {
        id: treatmentId,
        title: 'Vitamin D',
        status: 'active',
        dosageInstructions: '1 capsule daily',
      },
    ],
  });
  const dates = await Promise.all(
    [-6, -5, -4, -3, -2, -1, 0].map((offset) =>
      getBrowserLocalDate(page, offset)
    )
  );
  await openRoute(page, '/journal');
  await expect(page.getByTestId('actions-day-label')).toBeVisible();
  await expect(
    page.getByTestId(`treatment-log-row-${treatmentId}`)
  ).toHaveCount(0);
  await openRoute(page, viewUrl);
  await page.getByTestId('treatment-usage-start').click();
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    'Start taking: Vitamin D'
  );
  await expect(
    page.getByTestId('treatment-usage-instructions-input')
  ).toHaveValue('1 capsule daily');
  await saveChange(page, dates[1]);
  await page.getByTestId('treatment-usage-change').click();
  await expect(
    page.getByRole('radio', { name: 'On hold', exact: true })
  ).toBeChecked();
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-usage-notes').click();
  await page
    .getByTestId('treatment-usage-notes-input')
    .fill('Waiting for a refill');
  await expect(page.getByTestId('form-add-menu')).toHaveCount(0);
  await checkA11y(page);
  await saveChange(page, dates[3]);
  await expect(page.getByTestId('treatment-usage-section')).toContainText(
    'Waiting for a refill'
  );
  await page.getByTestId('treatment-usage-start').click();
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    'Resume taking: Vitamin D'
  );
  // Resuming shows the regimen last followed.
  await expect(
    page.getByTestId('treatment-usage-instructions-input')
  ).toHaveValue('1 capsule daily');
  await saveChange(page, dates[5]);
  await page.getByTestId('treatment-usage-change').click();
  await page.getByTestId('treatment-usage-kind-stop').click();
  await saveChange(page, dates[6]);

  const statements = await getTestTreatmentUsage(page, treatmentId);
  expect(statements).toHaveLength(4);
  expect(statements.map((statement) => statement.effectivePeriod)).toEqual([
    { start: dates[1], end: dates[2] },
    { start: dates[3], end: dates[4] },
    { start: dates[5], end: dates[5] },
    { start: dates[6] },
  ]);
  expect(
    statements.map((statement) => statement.adherence.code.coding[0].code)
  ).toEqual(['taking', 'on-hold', 'taking', 'stopped']);
  // Only periods of taking it record the regimen followed.
  expect(statements.map((statement) => statement.dosage)).toEqual([
    [{ text: '1 capsule daily' }],
    undefined,
    [{ text: '1 capsule daily' }],
    undefined,
  ]);
  for (const statement of statements) {
    expect(statement).toMatchObject({
      resourceType: 'MedicationStatement',
      status: 'recorded',
      subject: { reference: 'Patient/usage-patient' },
      medication: { concept: { text: 'Vitamin D' } },
      derivedFrom: [{ reference: `MedicationRequest/${treatmentId}` }],
    });
  }
  expect(statements[1].note).toEqual([{ text: 'Waiting for a refill' }]);
  expect((await getTestTreatment(page, treatmentId)).status).toBe('active');
  await reopenRoute(page);
  const usageRows = page.getByTestId(/^treatment-usage-period-/);
  const badge = page.getByTestId('treatment-usage-section-count');
  const toggle = page.getByTestId('treatment-usage-list-toggle');
  await expect(badge).toHaveText('4');
  await expect(usageRows).toHaveCount(3);
  await expect(usageRows.first()).toContainText('Stopped');
  await expect(usageRows.first()).toContainText('1 day');
  await expect(usageRows.first()).toHaveText(/Stopped.*1 day.*Since/);
  await expect(usageRows.nth(2)).toContainText('2 days');
  await expect(
    page.getByTestId(`treatment-usage-period-${statements[0].id}`)
  ).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(usageRows).toHaveCount(4);
  await expect(
    page.getByTestId(`treatment-usage-period-${statements[0].id}`)
  ).toBeVisible();
  await expect(badge).toHaveText('4');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(usageRows).toHaveCount(3);
  await expect(badge).toHaveText('4');
  await expect(
    page.getByTestId(`treatment-log-history-day-${dates[5]}-missing`)
  ).toBeVisible();
  for (const index of [0, 3, 4, 6]) {
    await expect(
      page.getByTestId(`treatment-log-history-day-${dates[index]}-missing`)
    ).toHaveCount(0);
  }
  for (const [index, date] of dates.entries()) {
    await openRoute(page, `/journal?date=${date}`);
    await expect(page.getByTestId('actions-day-label')).toBeVisible();
    await expect(
      page.getByTestId(`treatment-log-row-${treatmentId}`)
    ).toHaveCount([1, 2, 5].includes(index) ? 1 : 0);
  }
  // Removing a previously collapsed entry updates the total and removes the
  // toggle when the entire list fits in the three-row preview.
  await openRoute(page, viewUrl);
  await toggle.click();
  await removePeriod(page, statements[0].id);
  await expect(usageRows).toHaveCount(3);
  await expect(badge).toHaveText('3');
  await expect(toggle).toHaveCount(0);
});

test('validates dates, removes optional notes and confirms removing a period', async ({
  page,
}) => {
  const yesterday = await getBrowserLocalDate(page, -1);
  await seedTestResources(page, {
    treatmentUsage: [{ treatmentId, action: 'start', date: yesterday }],
  });
  await openRoute(page, viewUrl);
  await page.getByTestId('treatment-usage-change').click();
  const date = page.getByTestId('treatment-usage-date-picker').locator('input');
  await expect(date).toHaveAttribute('max', await getBrowserLocalDate(page));
  await date.fill(await getBrowserLocalDate(page, -2));
  await page.getByTestId('save-usage-button').click();
  await expect(page.getByTestId('treatment-usage-form-error')).toHaveText(
    `The date cannot be before ${yesterday}`
  );
  expect(await getTestTreatmentUsage(page, treatmentId)).toHaveLength(1);
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-usage-notes').click();
  await page
    .getByTestId('treatment-usage-notes-input')
    .fill('Discard this note');
  await page.getByTestId('remove-usage-notes-button').click();
  await expect(page.getByTestId('treatment-usage-notes-input')).toHaveCount(0);
  await saveChange(page, await getBrowserLocalDate(page));
  const statements = await getTestTreatmentUsage(page, treatmentId);
  expect(statements[1].note).toBeUndefined();
  await editPeriod(page, statements[1].id);
  await page.getByTestId('treatment-usage-remove-button').click();
  await page.getByTestId('delete-modal-cancel-button').click();
  await expect(page.getByTestId('treatment-usage-remove-dialog')).toHaveCount(
    0
  );
  expect(await getTestTreatmentUsage(page, treatmentId)).toHaveLength(2);
  await page.getByTestId('treatment-usage-remove-button').click();
  await page.getByTestId('delete-modal-confirm-button').click();
  await expect(page.getByTestId('treatment-usage-change')).toBeVisible();
  await expect(page.getByTestId('treatment-usage-section-count')).toHaveText(
    '1'
  );
  await expect(page.getByTestId('treatment-usage-list-toggle')).toHaveCount(0);
  await expect
    .poll(() => getTestTreatmentUsage(page, treatmentId))
    .toMatchObject([{ effectivePeriod: { start: yesterday } }]);
  expect(
    (await getTestTreatmentUsage(page, treatmentId))[0].effectivePeriod.end
  ).toBeUndefined();
  await removePeriod(page, statements[0].id);
  await expect(page.getByTestId('treatment-usage-section')).toHaveCount(0);
  await expect(page.getByTestId('treatment-usage-start')).toBeVisible();
});

test('explains a failed period removal and keeps the dialog open for retry', async ({
  page,
  consoleMonitor,
}) => {
  const today = await getBrowserLocalDate(page);
  await seedTestResources(page, {
    treatmentUsage: [{ treatmentId, action: 'start', date: today }],
  });
  await openRoute(page, viewUrl);
  const [statement] = await getTestTreatmentUsage(page, treatmentId);
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
      `CREATE TEMP TRIGGER fail_usage_delete BEFORE DELETE ON medication_statements BEGIN SELECT RAISE(ABORT, 'Synthetic removal failure'); END;`
    )
  );
  consoleMonitor.ignore('Failed to remove treatment usage:');
  await editPeriod(page, statement.id);
  await page.getByTestId('treatment-usage-remove-button').click();
  await page.getByTestId('delete-modal-confirm-button').click();
  const dialog = page.getByTestId('treatment-usage-remove-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('treatment-usage-remove-error')).toHaveText(
    'Failed to remove period. Please try again.'
  );
  expect(await getTestTreatmentUsage(page, treatmentId)).toHaveLength(1);
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
      'DROP TRIGGER fail_usage_delete;'
    )
  );
  await page.getByTestId('delete-modal-confirm-button').click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${viewUrl}$`));
  await expect(page.getByTestId('treatment-usage-section')).toHaveCount(0);
  expect(await getTestTreatmentUsage(page, treatmentId)).toHaveLength(0);
});

const dailyDose = (amount: string) => ({
  amount,
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
    when: 'MORN',
    boundsValue: '',
    boundsUnit: 'd',
  },
});

test('a new regimen starts a period, keeps earlier days on the old dose and flags answers it changed', async ({
  page,
}) => {
  const [fourAgo, threeAgo, twoAgo, yesterday, today] = await Promise.all(
    [-4, -3, -2, -1, 0].map((offset) => getBrowserLocalDate(page, offset))
  );
  await seedTestResources(page, {
    treatments: [
      {
        id: 'regimen',
        title: 'Prednisolone',
        status: 'active',
        regimen: { phases: [{ doses: [dailyDose('2')] }] },
        takingSince: fourAgo,
      },
    ],
    treatmentLogs: [threeAgo, yesterday].map((date) => ({
      treatmentId: 'regimen',
      date,
      answer: 'taken' as const,
      doseIndex: 0,
    })),
  });
  await openRoute(page, '/treatment/regimen');
  await expect(page.getByTestId('treatment-dosage')).toHaveText(
    '2 tablets in the morning'
  );
  await expect(page.getByTestId('treatment-current-regimen')).toHaveText(
    '2 tablets in the morning'
  );
  await page.getByTestId('treatment-usage-change').click();
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    'Change usage: Prednisolone'
  );
  await expect(page.getByTestId('treatment-regimen-field')).toHaveCount(0);
  await page.getByTestId('treatment-usage-kind-change').click();
  const amount = page.getByLabel('Min Amount');
  await expect(amount).toHaveValue('2');
  await checkA11y(page);
  // An unchanged regimen, or one dated before the current period, is not saved.
  await page.getByTestId('save-usage-button').click();
  await expect(page.getByTestId('treatment-usage-form-error')).toHaveText(
    'The new regimen is the same as the current one'
  );
  await amount.fill('1');
  await page
    .getByTestId('treatment-usage-date-picker')
    .locator('input')
    .fill(await getBrowserLocalDate(page, -5));
  await page.getByTestId('save-usage-button').click();
  await expect(page.getByTestId('treatment-usage-form-error')).toHaveText(
    `The date cannot be before ${fourAgo}`
  );
  await saveChange(page, twoAgo, '/treatment/regimen');

  const statements = await getTestTreatmentUsage(page, 'regimen');
  const amountOf = (statement: any) =>
    statement.dosage[0].doseAndRate[0].doseQuantity.value;
  expect(statements.map((statement) => statement.effectivePeriod)).toEqual([
    { start: fourAgo, end: threeAgo },
    { start: twoAgo },
  ]);
  expect(statements.map(amountOf)).toEqual([2, 1]);
  expect(
    statements.map((statement) => statement.adherence.code.coding[0].code)
  ).toEqual(['taking', 'taking']);
  // The prescription is unchanged.
  const prescribed = await getTestTreatment(page, 'regimen');
  expect(
    prescribed.dosageInstruction[0].doseAndRate[0].doseQuantity.value
  ).toBe(2);
  await expect(page.getByTestId('treatment-dosage')).toHaveText(
    '2 tablets in the morning'
  );
  await expect(page.getByTestId('treatment-current-regimen')).toHaveText(
    '1 tablet in the morning'
  );
  const rows = page.getByTestId(/^treatment-usage-period-/);
  await expect(rows.first()).toContainText('1 tablet in the morning');
  await expect(rows.nth(1)).toContainText('2 tablets in the morning');

  // Each day lists the dose of its own regimen; an answer given under the
  // old one on a day the new one covers is flagged.
  const row = page.getByTestId('treatment-log-row-regimen-0');
  const warning = page.getByTestId('treatment-log-mismatch-regimen-0');
  await openRoute(page, `/journal?date=${threeAgo}`);
  await expect(row).toContainText('2 tablets in the morning');
  await expect(warning).toHaveCount(0);
  await openRoute(page, `/journal?date=${yesterday}`);
  await expect(row).toContainText('2 tablets in the morning');
  await expect(warning).toHaveText("Doesn't match the current regimen");
  await checkA11y(page);
  await openRoute(page, `/journal?date=${today}`);
  await expect(row).toContainText('1 tablet in the morning');
  await expect(warning).toHaveCount(0);
  await page.getByTestId('treatment-log-taken-regimen-0').click();
  await expect
    .poll(
      async () =>
        (await getTestTreatmentLog(page, `regimen-${today}-0`))?.dosage?.text
    )
    .toBe('1 tablet in the morning');
});

test('free-text dosing starts from the prescription and a same-day new regimen corrects the period', async ({
  page,
}) => {
  const [twoAgo, yesterday, today] = await Promise.all(
    [-2, -1, 0].map((offset) => getBrowserLocalDate(page, offset))
  );
  await seedTestResources(page, {
    treatments: [
      {
        id: 'text-dosing',
        title: 'Vitamin B12',
        status: 'active',
        dosageInstructions: '1 capsule daily',
      },
    ],
  });
  await openRoute(page, '/treatment/text-dosing');
  await page.getByTestId('treatment-usage-start').click();
  await expect(
    page.getByTestId('treatment-usage-instructions-input')
  ).toHaveValue('1 capsule daily');
  await saveChange(page, twoAgo, '/treatment/text-dosing');
  expect((await getTestTreatmentUsage(page, 'text-dosing'))[0].dosage).toEqual([
    { text: '1 capsule daily' },
  ]);
  await seedTestResources(page, {
    treatmentLogs: [
      { treatmentId: 'text-dosing', date: yesterday, answer: 'taken' },
    ],
  });
  await openRoute(page, '/treatment/text-dosing');
  await page.getByTestId('treatment-usage-change').click();
  await page.getByTestId('treatment-usage-kind-change').click();
  const instructions = page.getByTestId('treatment-usage-instructions-input');
  await expect(instructions).toHaveValue('1 capsule daily');
  // Without dosing, a new regimen cannot be saved.
  await page.getByTestId('remove-treatment-usage-instructions-button').click();
  await page.getByTestId('save-usage-button').click();
  await expect(page.getByTestId('treatment-usage-form-error')).toHaveText(
    'Enter the dosage or regimen'
  );
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-treatment-usage-instructions').click();
  await instructions.fill('2 capsules daily');
  await saveChange(page, twoAgo, '/treatment/text-dosing');

  const statements = await getTestTreatmentUsage(page, 'text-dosing');
  expect(statements).toHaveLength(1);
  expect(statements[0]).toMatchObject({
    effectivePeriod: { start: twoAgo },
    dosage: [{ text: '2 capsules daily' }],
  });
  expect(
    (await getTestTreatment(page, 'text-dosing')).dosageInstruction
  ).toEqual([{ text: '1 capsule daily' }]);
  await openRoute(page, `/journal?date=${yesterday}`);
  await expect(page.getByTestId('treatment-log-row-text-dosing')).toContainText(
    '1 capsule daily'
  );
  await expect(
    page.getByTestId('treatment-log-mismatch-text-dosing')
  ).toBeVisible();
  await openRoute(page, `/journal?date=${today}`);
  await expect(page.getByTestId('treatment-log-row-text-dosing')).toBeVisible();
  await expect(
    page.getByTestId('treatment-log-mismatch-text-dosing')
  ).toHaveCount(0);
  await page.getByTestId('treatment-log-taken-text-dosing').click();
  await expect
    .poll(
      async () =>
        (await getTestTreatmentLog(page, `text-dosing-${today}`))?.dosage
    )
    .toEqual({ text: '2 capsules daily' });
});

test('edits a period status, notes and regimen but not its dates', async ({
  page,
}) => {
  const [threeAgo, yesterday] = await Promise.all(
    [-3, -1].map((offset) => getBrowserLocalDate(page, offset))
  );
  await seedTestResources(page, {
    treatmentUsage: [
      { treatmentId, action: 'start', date: threeAgo },
      { treatmentId, action: 'pause', date: yesterday, notes: 'Refill' },
    ],
  });
  await openRoute(page, viewUrl);
  const [, paused] = await getTestTreatmentUsage(page, treatmentId);
  await editPeriod(page, paused.id);
  await expect(page.getByTestId('treatment-usage-date-picker')).toHaveCount(0);
  await expect(
    page.getByRole('radio', { name: 'On hold', exact: true })
  ).toBeChecked();
  await expect(page.getByTestId('treatment-usage-notes-input')).toHaveValue(
    'Refill'
  );
  await checkA11y(page);
  // Taking it records the regimen followed, added from the + menu.
  await page.getByTestId('treatment-usage-state-taking').click();
  // No regimen was recorded or prescribed, so it opens on an empty one.
  await page.getByTestId('remove-treatment-usage-regimen-button').click();
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-treatment-usage-instructions').click();
  await page
    .getByTestId('treatment-usage-instructions-input')
    .fill('Half a capsule');
  await page
    .getByTestId('treatment-usage-notes-input')
    .fill('Kept taking it after all');
  await page.getByTestId('save-usage-button').click();
  await expect(page).toHaveURL(new RegExp(`${viewUrl}$`));

  const edited = (await getTestTreatmentUsage(page, treatmentId))[1];
  expect(edited).toMatchObject({
    id: paused.id,
    effectivePeriod: paused.effectivePeriod,
    adherence: { code: { coding: [{ code: 'taking' }] } },
    note: [{ text: 'Kept taking it after all' }],
    dosage: [{ text: 'Half a capsule' }],
  });
  await expect(
    page.getByTestId(`treatment-usage-period-${paused.id}`)
  ).toContainText('Kept taking it after all');
  await openRoute(page, `/journal?date=${yesterday}`);
  await expect(
    page.getByTestId(`treatment-log-row-${treatmentId}`)
  ).toBeVisible();
});

test('starting a supplement without a prescription asks for its regimen', async ({
  page,
}) => {
  const today = await getBrowserLocalDate(page);
  await openRoute(page, viewUrl);
  await page.getByTestId('treatment-usage-start').click();
  await expect(page.getByTestId('treatment-regimen-field')).toBeVisible();
  await page.getByTestId('save-usage-button').click();
  await expect(page.getByTestId('treatment-usage-form-error')).toHaveText(
    'Enter a min amount'
  );
  await page.getByTestId('remove-treatment-usage-regimen-button').click();
  await page.getByTestId('save-usage-button').click();
  await expect(page.getByTestId('treatment-usage-form-error')).toHaveText(
    'Enter the dosage or regimen'
  );
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-treatment-usage-instructions').click();
  await page
    .getByTestId('treatment-usage-instructions-input')
    .fill('1 capsule daily');
  await saveChange(page, today);
  const [statement] = await getTestTreatmentUsage(page, treatmentId);
  expect(statement.dosage).toEqual([{ text: '1 capsule daily' }]);
  expect((await getTestTreatment(page, treatmentId)).dosageInstruction).toBe(
    undefined
  );
});
