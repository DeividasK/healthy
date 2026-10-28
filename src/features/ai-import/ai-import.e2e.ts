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

const card = (page: Page, ref: string) =>
  page.getByTestId(`ai-import-card-${ref}`);

async function decideAll(
  page: Page,
  decisions: Record<string, 'accept' | 'skip'>
) {
  for (const [ref, decision] of Object.entries(decisions))
    await page.getByTestId(`ai-import-card-${ref}-${decision}`).click();
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
    await expect(card(page, 'physio-links')).toHaveText(
      /Planned in Physical medicine consultation.*Reason: Soft tissue overuse disorder/
    );
    await expect(card(page, 'knee-links')).toHaveText(
      'Diagnosed in Physical medicine consultation'
    );
    await expect(card(page, 'visit-links')).toHaveText(
      'Diagnosis: Soft tissue overuse disorder'
    );
    await expect(card(page, 'physio')).toContainText(
      'From “3.11. Non-drug treatment”'
    );
    await expect(card(page, 'gel')).toContainText(
      'Apply to the knee twice a day'
    );
    await checkA11y(page, { include: '[data-testid="ai-import-review"]' });

    // Nothing can be added until every card is checked.
    const add = page.getByTestId('ai-import-add-button');
    await decideAll(page, {
      visit: 'accept',
      knee: 'accept',
      physio: 'accept',
    });
    await expect(add).toBeDisabled();

    // A card is edited in its full form; the change returns to the card.
    await page.getByTestId('ai-import-card-checkup-edit').click();
    await expect(page).toHaveURL(/\/ai-import\/edit\?ref=checkup$/);
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
    await page.getByTestId('save-service-request-button').click();
    await expect(page).toHaveURL(/\/ai-import$/);
    await expect(card(page, 'checkup-title')).toHaveText(
      '3D movement assessment'
    );
    // The decisions made before editing are kept.
    await expect(card(page, 'visit-decision')).toHaveText('Accepted');

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
    await page.getByTestId('ai-import-card-visit-skip').click();
    await expect(card(page, 'visit-decision')).toHaveText('Skipped');
    // Every card linked to it says so before anything is saved.
    for (const ref of ['knee', 'physio', 'checkup', 'gel'])
      await expect(card(page, `${ref}-links`)).toContainText(
        'Not linked: Physical medicine consultation is skipped'
      );
    // Undo brings the link back.
    await page.getByTestId('ai-import-card-visit-undo').click();
    await expect(card(page, 'physio-links')).toContainText(
      'Planned in Physical medicine consultation'
    );
    await page.getByTestId('ai-import-card-visit-skip').click();

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
    await page.getByTestId('ai-import-card-knee-skip').click();
    await expect(card(page, 'visit-links')).toHaveText(
      'Not linked: Soft tissue overuse disorder is skipped'
    );
    await expect(card(page, 'physio-links')).toContainText(
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
    await expect(card(page, 'knee-existing')).toHaveValue(existing.id!);
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
