import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  checkA11y,
  evaluateBridge,
  openRoute,
} from '@/src/features/testing/testStorage';

const RECORDS = [
  {
    type: 'consultation',
    ref: 'visit',
    source: '2. Visit details',
    title: 'Physical medicine consultation',
    date: '2026-01-15',
    time: '10:02',
    specialist: 'Dr. Ruth Moss',
    serviceProvider: 'City Clinic',
  },
  {
    type: 'condition',
    ref: 'knee',
    source: '3.4. Diagnoses',
    consultation: 'visit',
    name: 'Soft tissue overuse disorder',
    icd10: 'M70.8',
    verification: 'provisional',
    onset: '2025-12-30',
  },
  {
    type: 'serviceRequest',
    ref: 'physio',
    source: '3.11. Non-drug treatment',
    consultation: 'visit',
    conditions: ['knee'],
    service: 'Physiotherapist consultation',
    category: 'Referral',
    intent: 'order',
    date: '2026-01-15',
  },
  {
    type: 'serviceRequest',
    ref: 'checkup',
    consultation: 'visit',
    conditions: ['knee'],
    service: 'Movement assessment',
    category: 'Procedure',
    intent: 'order',
    source: '3.12. Follow-up',
  },
  {
    type: 'treatment',
    ref: 'gel',
    consultation: 'visit',
    conditions: ['knee'],
    name: 'Diclofenac 1% gel',
    intent: 'order',
    dosage: 'Apply to the knee twice a day',
  },
];

const reply = (records: unknown[] = RECORDS) =>
  `I found one visit.\n\n\`\`\`json\n${JSON.stringify({
    healthyImport: 1,
    summary: 'A physical medicine visit with one diagnosis and three orders.',
    records,
  })}\n\`\`\``;

async function importReply(page: Page, text = reply()) {
  await openRoute(page, '/');
  await page.getByTestId('home-import-with-ai-button').click();
  await page.getByTestId('ai-import-reply-input').fill(text);
  await page.getByTestId('ai-import-submit-button').click();
  await expect(page).toHaveURL(/\/ai-import$/);
  await expect(page.getByTestId('ai-import-review')).toBeVisible();
}

const row = (page: Page, ref: string) =>
  page.getByTestId(`ai-import-row-${ref}`);

const ANSWERS = { accept: 'taken', skip: 'not-taken' } as const;

/** A row's accept (✓) or skip (✕) button; pressed again, it undoes. */
const answer = (page: Page, ref: string, decision: 'accept' | 'skip') =>
  page.getByTestId(`ai-import-row-${ANSWERS[decision]}-${ref}`);

async function decideAll(
  page: Page,
  decisions: Record<string, 'accept' | 'skip'>
) {
  for (const [ref, decision] of Object.entries(decisions))
    await answer(page, ref, decision).click();
}

/** Desktop edits a row beside the list; a phone opens its own screen. */
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1200;

async function openRow(page: Page, ref: string) {
  await page.getByTestId(`ai-import-row-${ref}-open`).click();
  if (!isWide(page))
    await expect(page).toHaveURL(new RegExp(`/ai-import/edit\\?ref=${ref}$`));
}

async function saveEdit(page: Page, saveTestID: string) {
  await page.getByTestId(saveTestID).click();
  if (!isWide(page)) await expect(page).toHaveURL(/\/ai-import$/);
}

/** Every stored record of a table for the patient, parsed. */
const stored = (page: Page, table: string) =>
  evaluateBridge<{ fhir_json: string }[]>(
    page,
    (b, table) => b.querySql(`SELECT fhir_json FROM ${table};`),
    table
  ).then((rows) => rows.map((row) => JSON.parse(row.fhir_json)));

const reasonIds = (resource: {
  reason?: { reference?: { reference?: string } }[];
}) =>
  (resource.reason ?? []).flatMap((reason) =>
    reason.reference?.reference ? [reason.reference.reference] : []
  );

test.describe('Import with AI', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('adds every accepted record from one reply, linked to each other', async ({
    page,
  }) => {
    await importReply(page);
    await expect(page.getByTestId('ai-import-summary')).toHaveText(
      'A physical medicine visit with one diagnosis and three orders.'
    );
    await expect(page.getByTestId('ai-import-progress')).toHaveText(
      '0 of 5 accepted · 5 to check'
    );
    await expect(row(page, 'physio')).toContainText(
      'Planned in Physical medicine consultation'
    );
    await expect(row(page, 'physio')).toContainText(
      'Reason: Soft tissue overuse disorder'
    );
    await expect(row(page, 'knee')).toContainText(
      'Diagnosed in Physical medicine consultation'
    );
    await expect(row(page, 'visit')).toContainText(
      'Diagnosis: Soft tissue overuse disorder'
    );
    await expect(row(page, 'gel')).toContainText(
      'Apply to the knee twice a day'
    );
    await checkA11y(page, { include: '[data-testid="ai-import-review"]' });

    // Nothing can be added until every row is checked.
    const add = page.getByTestId('ai-import-add-button');
    await decideAll(page, {
      visit: 'accept',
      knee: 'accept',
      physio: 'accept',
    });
    await expect(add).toBeDisabled();

    // A row opens its full form; the change returns to the row.
    await openRow(page, 'checkup');
    await expect(page.getByTestId('ai-import-edit-source')).toHaveText(
      'From “3.12. Follow-up” in your document'
    );
    await expect(page.getByTestId('service-request-form-title')).toHaveText(
      'Edit Proposed Service Request'
    );
    await expect(page.getByTestId('import-with-ai-button')).toHaveCount(0);
    await expect(
      page.getByTestId('service-request-category-select')
    ).toHaveValue('71388002');
    await page
      .getByTestId('service-request-title-input')
      .fill('3D movement assessment');
    await saveEdit(page, 'save-service-request-button');
    await expect(row(page, 'checkup')).toContainText('3D movement assessment');
    // The decisions made before editing are kept.
    await expect(answer(page, 'visit', 'accept')).toBeChecked();

    await decideAll(page, { checkup: 'accept', gel: 'accept' });
    await expect(page.getByTestId('ai-import-progress')).toHaveText(
      '5 of 5 accepted'
    );
    await add.click();

    // The saved consultation opens, listing what came with it.
    await expect(page).toHaveURL(/\/consultation\/cons-/);
    const view = page.getByTestId('consultation-view');
    await expect(view.getByText('Physiotherapist consultation')).toBeVisible();
    await expect(view.getByText('3D movement assessment')).toBeVisible();
    await expect(view.getByText('Diclofenac 1% gel')).toBeVisible();
    await expect(view.getByText('Soft tissue overuse disorder')).toBeVisible();

    const [condition] = await stored(page, 'conditions');
    expect(condition).toMatchObject({
      code: {
        text: 'Soft tissue overuse disorder',
        coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'M70.8' }],
      },
      onsetDateTime: '2025-12-30',
      verificationStatus: { coding: [{ code: 'provisional' }] },
    });
    const [consultation] = await stored(page, 'consultations');
    expect(consultation.diagnosis[0].condition[0].reference).toEqual({
      reference: `Condition/${condition.id}`,
    });
    const requests = await stored(page, 'service_requests');
    expect(requests).toHaveLength(2);
    const [treatment] = await stored(page, 'medication_requests');
    for (const record of [...requests, treatment]) {
      expect(record.encounter).toEqual({
        reference: `Encounter/${consultation.id}`,
      });
      expect(reasonIds(record)).toEqual([`Condition/${condition.id}`]);
    }

    // The review is done; going there again shows nothing to check.
    await openRoute(page, '/ai-import');
    await expect(page.getByTestId('ai-import-review-empty')).toBeVisible();
  });

  test('records from a skipped consultation are added without a visit link', async ({
    page,
  }) => {
    await importReply(page);
    await answer(page, 'visit', 'skip').click();
    await expect(answer(page, 'visit', 'skip')).toBeChecked();
    // Every row linked to it says so before anything is saved.
    for (const ref of ['knee', 'physio', 'checkup', 'gel'])
      await expect(row(page, ref)).toContainText(
        'Not linked: Physical medicine consultation is skipped'
      );
    // Pressing ✕ again undoes the skip and brings the link back.
    await answer(page, 'visit', 'skip').click();
    await expect(answer(page, 'visit', 'skip')).not.toBeChecked();
    await expect(row(page, 'physio')).toContainText(
      'Planned in Physical medicine consultation'
    );
    await answer(page, 'visit', 'skip').click();

    await decideAll(page, {
      knee: 'accept',
      physio: 'accept',
      checkup: 'skip',
      gel: 'skip',
    });
    await page.getByTestId('ai-import-add-button').click();
    // With no consultation added, Home opens.
    await expect(page).toHaveURL(/\/$/);

    expect(await stored(page, 'consultations')).toHaveLength(0);
    expect(await stored(page, 'medication_requests')).toHaveLength(0);
    const [condition] = await stored(page, 'conditions');
    const requests = await stored(page, 'service_requests');
    expect(requests).toHaveLength(1);
    expect(requests[0].encounter).toBeUndefined();
    expect(reasonIds(requests[0])).toEqual([`Condition/${condition.id}`]);
  });

  test('a skipped diagnosis is left out of the visit and the orders', async ({
    page,
  }) => {
    await importReply(page);
    await answer(page, 'knee', 'skip').click();
    await expect(row(page, 'visit')).toContainText(
      'Not linked: Soft tissue overuse disorder is skipped'
    );
    await expect(row(page, 'physio')).toContainText(
      'Not linked: Soft tissue overuse disorder is skipped'
    );
    await decideAll(page, {
      visit: 'accept',
      physio: 'accept',
      checkup: 'accept',
      gel: 'accept',
    });
    await page.getByTestId('ai-import-add-button').click();
    await expect(page).toHaveURL(/\/consultation\/cons-/);

    expect(await stored(page, 'conditions')).toHaveLength(0);
    const [consultation] = await stored(page, 'consultations');
    expect(consultation.diagnosis ?? []).toHaveLength(0);
    for (const request of await stored(page, 'service_requests')) {
      expect(request.encounter).toEqual({
        reference: `Encounter/${consultation.id}`,
      });
      expect(reasonIds(request)).toEqual([]);
    }
  });

  test('links a condition the patient already has instead of adding it again', async ({
    page,
  }) => {
    const existing = await seedTestCondition(page, {
      title: 'Soft tissue overuse disorder',
    });
    await importReply(page);
    await expect(row(page, 'knee')).toContainText(
      'Saved as your Soft tissue overuse disorder'
    );
    // The diagnosis's form says which condition it is saved as.
    await openRow(page, 'knee');
    await expect(page.getByTestId('ai-import-existing-knee')).toHaveValue(
      existing.id!
    );
    if (!isWide(page)) await page.goBack();
    await decideAll(page, {
      visit: 'accept',
      knee: 'accept',
      physio: 'accept',
      checkup: 'skip',
      gel: 'skip',
    });
    await page.getByTestId('ai-import-add-button').click();
    await expect(page).toHaveURL(/\/consultation\/cons-/);

    const conditions = await stored(page, 'conditions');
    expect(conditions.map((condition) => condition.id)).toEqual([existing.id]);
    const [consultation] = await stored(page, 'consultations');
    expect(consultation.diagnosis[0].condition[0].reference).toEqual({
      reference: `Condition/${existing.id}`,
    });
    const [request] = await stored(page, 'service_requests');
    expect(reasonIds(request)).toEqual([`Condition/${existing.id}`]);
  });

  test('an edited treatment keeps the regimen the form left unchanged', async ({
    page,
  }) => {
    await importReply(
      page,
      reply([
        {
          type: 'treatment',
          ref: 'vitd',
          name: 'Vitamin D3',
          intent: 'plan',
          regimen: [
            {
              doses: [
                {
                  amount: 1,
                  unit: 'capsule',
                  times: 1,
                  every: 1,
                  everyUnit: 'd',
                },
              ],
            },
          ],
        },
      ])
    );
    await openRow(page, 'vitd');
    await page.getByTestId('treatment-title-input').fill('Vitamin D3 2000 IU');
    await saveEdit(page, 'save-treatment-button');
    await expect(row(page, 'vitd')).toContainText('Vitamin D3 2000 IU');
    await answer(page, 'vitd', 'accept').click();
    await page.getByTestId('ai-import-add-button').click();
    await expect(page).toHaveURL(/\/$/);

    const [treatment] = await stored(page, 'medication_requests');
    expect(treatment.medication.concept.text).toBe('Vitamin D3 2000 IU');
    expect(treatment.dosageInstruction).toHaveLength(1);
    expect(
      treatment.dosageInstruction[0].doseAndRate[0].doseQuantity
    ).toMatchObject({ value: 1 });
  });

  test('desktop keeps an edit made beside the list when another row opens or the records are added', async ({
    page,
  }) => {
    test.skip(!isWide(page), 'Phones edit a row on its own screen.');
    await importReply(page);
    // The first row to check opens beside the list.
    await expect(row(page, 'visit')).toHaveAttribute('aria-current', 'true');
    await page.getByTestId('consultation-title-input').fill('Knee visit');
    await page.getByTestId('ai-import-row-physio-open').click();
    await expect(row(page, 'physio')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('service-request-form-title')).toBeVisible();
    await expect(row(page, 'visit')).toContainText('Knee visit');

    await page
      .getByTestId('service-request-title-input')
      .fill('Physiotherapy, 5 sessions');
    await decideAll(page, {
      visit: 'accept',
      knee: 'accept',
      physio: 'accept',
      checkup: 'skip',
      gel: 'skip',
    });
    await page.getByTestId('ai-import-add-button').click();
    await expect(page).toHaveURL(/\/consultation\/cons-/);
    await expect(page.getByTestId('consultation-view')).toContainText(
      'Knee visit'
    );
    const [request] = await stored(page, 'service_requests');
    expect(request.code.concept.text).toBe('Physiotherapy, 5 sessions');
  });

  test('lists every problem in a reply that cannot be read', async ({
    page,
  }) => {
    await openRoute(page, '/');
    await page.getByTestId('home-import-with-ai-button').click();
    await page.getByTestId('ai-import-reply-input').fill(
      reply([
        { type: 'consultation', ref: 'visit', date: '2026-01-15' },
        { type: 'serviceRequest', service: 'MRI', consultation: 'other' },
      ])
    );
    await page.getByTestId('ai-import-submit-button').click();
    await expect(page.getByTestId('ai-import-errors')).toHaveText(
      [
        'Record 1 (consultation): The consultation title is missing.',
        'The service request "MRI" links to "other", which is not a consultation in the reply.',
      ].join('\n')
    );
    await expect(page).toHaveURL(/\/$/);
  });
});
