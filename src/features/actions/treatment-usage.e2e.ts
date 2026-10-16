import type { Page } from '@playwright/test';
import {
  test,
  expect,
  checkA11y,
  getBrowserLocalDate,
  getTestTreatment,
  getTestTreatmentUsage,
  seedTestPatient,
  seedTestResources,
} from '@/src/features/testing/testStorage';

const treatmentId = 'usage-treatment';
const viewUrl = `/treatment/${treatmentId}`;

async function saveChange(page: Page, date: string) {
  await page
    .getByTestId('treatment-usage-date-picker')
    .locator('input')
    .fill(date);
  await page.getByTestId('save-usage-button').click();
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
  const dates = await Promise.all(
    [-6, -5, -4, -3, -2, -1, 0].map((offset) =>
      getBrowserLocalDate(page, offset)
    )
  );
  await page.goto('/journal');
  await expect(page.getByTestId('actions-day-label')).toBeVisible();
  await expect(
    page.getByTestId(`treatment-log-row-${treatmentId}`)
  ).toHaveCount(0);
  await page.goto(viewUrl);
  await page.getByTestId('treatment-usage-start').click();
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    'Start taking: Vitamin D'
  );
  await checkA11y(page);
  await saveChange(page, dates[1]);
  await page.getByTestId('treatment-usage-stop').click();
  await expect(
    page.getByRole('radio', { name: 'On hold', exact: true })
  ).toBeChecked();
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-usage-notes').click();
  await page
    .getByTestId('treatment-usage-notes-input')
    .fill('Waiting for a refill');
  await checkA11y(page);
  await saveChange(page, dates[3]);
  await expect(page.getByTestId('treatment-usage-section')).toContainText(
    'Waiting for a refill'
  );
  await page.getByTestId('treatment-usage-start').click();
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    'Resume taking: Vitamin D'
  );
  await saveChange(page, dates[5]);
  await page.getByTestId('treatment-usage-stop').click();
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
  await page.reload();
  await expect(page.getByTestId(/^treatment-usage-period-/)).toHaveCount(4);
  await expect(
    page.getByTestId(`treatment-log-history-day-${dates[5]}-missing`)
  ).toBeVisible();
  for (const index of [0, 3, 4, 6]) {
    await expect(
      page.getByTestId(`treatment-log-history-day-${dates[index]}-missing`)
    ).toHaveCount(0);
  }
  for (const [index, date] of dates.entries()) {
    await page.goto(`/journal?date=${date}`);
    await expect(page.getByTestId('actions-day-label')).toBeVisible();
    await expect(
      page.getByTestId(`treatment-log-row-${treatmentId}`)
    ).toHaveCount([1, 2, 5].includes(index) ? 1 : 0);
  }
});

test('validates dates, removes optional notes and confirms removing a period', async ({
  page,
}) => {
  const yesterday = await getBrowserLocalDate(page, -1);
  await seedTestResources(page, {
    treatmentUsage: [{ treatmentId, action: 'start', date: yesterday }],
  });
  await page.goto(viewUrl);
  await page.getByTestId('treatment-usage-stop').click();
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
  await page.getByTestId(`treatment-usage-remove-${statements[1].id}`).click();
  await page.getByTestId('delete-modal-cancel-button').click();
  await expect(page.getByTestId(/^treatment-usage-period-/)).toHaveCount(2);
  await page.getByTestId(`treatment-usage-remove-${statements[1].id}`).click();
  await page.getByTestId('delete-modal-confirm-button').click();
  await expect(page.getByTestId('treatment-usage-stop')).toBeVisible();
  await expect
    .poll(() => getTestTreatmentUsage(page, treatmentId))
    .toMatchObject([{ effectivePeriod: { start: yesterday } }]);
  expect(
    (await getTestTreatmentUsage(page, treatmentId))[0].effectivePeriod.end
  ).toBeUndefined();
  await page.getByTestId(`treatment-usage-remove-${statements[0].id}`).click();
  await page.getByTestId('delete-modal-confirm-button').click();
  await expect(page.getByTestId('treatment-usage-section')).toHaveCount(0);
  await expect(page.getByTestId('treatment-usage-start')).toBeVisible();
});
