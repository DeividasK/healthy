import {
  test,
  expect,
  seedTestPatient,
  seedTestTreatment,
  seedTestConsultation,
  getTestTreatment,
  getTestClinicalDocument,
  findTreatmentsSection,
  seedTestCondition,
  checkA11y,
  openRoute,
} from '@/src/features/testing/testStorage';

test.beforeEach(async ({ page }) => {
  await seedTestPatient(page, { id: 'integrity-patient' });
});

// Every form builds its optional fields with useOptionalFields; this covers
// the shared add, remove and clear behaviour on the form with the most fields.
test('optional fields can be added, removed, re-added, and cleared after reload', async ({
  page,
}) => {
  // Associated conditions are only offered when a condition exists.
  await seedTestCondition(page, { title: 'Integrity condition' });
  await openRoute(page, '/treatment/add');
  await expect(page.getByTestId('treatment-status-select')).toHaveValue(
    'active'
  );
  const addField = async (field: string) => {
    await page.getByTestId('add-option-button').click();
    await page.getByTestId(`menu-add-treatment-${field}`).click();
    // Wait for the closing menu to leave so its items are not matched twice.
    await expect(page.getByTestId('form-add-menu')).toHaveCount(0);
  };
  // A removed field is cleared, so re-adding it starts empty.
  await addField('notes');
  await page.getByTestId('treatment-notes-input').fill('Discarded notes');
  await page.getByTestId('remove-treatment-notes-button').click();
  await expect(page.getByTestId('treatment-notes-input')).toHaveCount(0);
  const textFields = ['instructions', 'reason', 'notes', 'requester'];
  for (const field of textFields) {
    await addField(field);
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveValue('');
    await page.getByTestId(`treatment-${field}-input`).fill(`Saved ${field}`);
  }
  // Text instructions exclude a regimen; an empty quantity saves nothing
  await addField('dispenseQuantity');
  // An empty associated-conditions field saves no link
  await addField('reasonCondition');
  await expect(page.getByTestId(/^treatment-selected-condition-/)).toHaveCount(
    0
  );
  await expect(page.getByTestId('add-option-button')).toBeDisabled();
  await page.getByTestId('treatment-title-input').fill('Optional fields');
  await checkA11y(page, { include: '[data-testid="treatment-form"]' });
  await page.getByTestId('save-treatment-button').click();
  await expect(page).not.toHaveURL(/treatment\/add/);
  const rows = await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
      'SELECT id FROM medication_requests'
    )
  );
  await openRoute(page, `/treatment/${rows[0].id}/edit`);
  for (const field of textFields) {
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveValue(
      `Saved ${field}`
    );
    await page.getByTestId(`remove-treatment-${field}-button`).click();
  }
  await page.getByTestId('save-treatment-button').click();
  await expect(page).not.toHaveURL(/\/edit$/);
  await openRoute(page, `/treatment/${rows[0].id}/edit`);
  for (const field of textFields) {
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveCount(0);
  }
  const saved = await getTestTreatment(page, rows[0].id);
  expect(saved.reason).toBeUndefined();
  expect(saved.note).toBeUndefined();
  expect(saved.dosageInstruction).toBeUndefined();
  expect(saved.requester).toBeUndefined();
  expect(saved.status).toBe('active');
});

test('editing imported requests preserves nested FHIR data and date-time precision', async ({
  page,
}) => {
  const resource = {
    resourceType: 'MedicationRequest',
    id: 'imported-request',
    status: 'ended',
    intent: 'proposal',
    subject: {
      reference: 'Patient/integrity-patient',
      display: 'Original patient display',
    },
    authoredOn: '2026-03-01T08:30:00+02:00',
    medication: {
      concept: {
        text: 'Imported request',
        coding: [{ system: 'https://example.org/medication', code: 'med' }],
      },
    },
    dosageInstruction: [
      {
        text: 'Original instructions',
        route: { text: 'Oral' },
        timing: { repeat: { frequency: 2, period: 1, periodUnit: 'd' } },
      },
      { text: 'Additional instructions', sequence: 2 },
    ],
    reason: [
      {
        concept: {
          text: 'Original reason',
          coding: [{ system: 'https://example.org/reason', code: 'reason' }],
        },
        // Not a Condition, so the form cannot edit it and must keep it
        reference: { reference: 'Observation/imported-observation' },
      },
      { concept: { text: 'Second reason' } },
    ],
    note: [
      { text: 'First note', authorString: 'Original author' },
      { text: 'Second note', authorString: 'Other author' },
    ],
    text: {
      status: 'additional',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Imported narrative</div>',
    },
    meta: { tag: [{ system: 'https://example.org/source', code: 'import' }] },
  };
  await page.evaluate(
    (resource) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.saveTreatment(
        resource,
        'integrity-patient'
      ),
    resource
  );
  await openRoute(page, '/treatment/imported-request/edit');
  await expect(page.getByTestId('treatment-intent-select')).toHaveValue(
    'proposal'
  );
  await expect(page.getByTestId('treatment-status-select')).toHaveValue(
    'ended'
  );
  await page.getByTestId('treatment-title-input').fill('Edited request');
  // Text stored beside structured dosing opens as a regimen and is kept.
  await expect(page.getByTestId('treatment-instructions-input')).toHaveCount(0);
  await expect(
    page.getByTestId('treatment-regimen-p1-d1-frequency-input')
  ).toHaveValue('2');
  await page.getByTestId('remove-treatment-reason-button').click();
  await page.getByTestId('treatment-notes-input').fill('Edited first note');
  await page.getByTestId('save-treatment-button').click();
  await expect(page).not.toHaveURL(/\/edit$/);
  const saved = await getTestTreatment(page, resource.id);
  expect(saved.authoredOn).toBe(resource.authoredOn);
  expect(saved.subject).toEqual(resource.subject);
  expect(saved.medication.concept.coding).toEqual(
    resource.medication.concept.coding
  );
  expect(saved.dosageInstruction).toEqual(resource.dosageInstruction);
  expect(saved.reason[0]).toEqual({
    concept: { coding: resource.reason[0].concept.coding },
    reference: resource.reason[0].reference,
  });
  expect(saved.reason[1]).toEqual(resource.reason[1]);
  expect(saved.note).toEqual([
    { ...resource.note[0], text: 'Edited first note' },
    resource.note[1],
  ]);
  expect(saved.text).toEqual(resource.text);
  expect(saved.meta.tag).toEqual(resource.meta.tag);
  expect(saved.intent).toBe('proposal');
  expect(saved.status).toBe('ended');
});

test('linking preserves document metadata and unlinking an origin survives edits', async ({
  page,
}) => {
  const consultation = await seedTestConsultation(page, {
    title: 'Origin consultation',
  });
  const treatment = await seedTestTreatment(page, {
    title: 'Origin treatment',
    consultationId: consultation.id,
  });
  const initial = await getTestClinicalDocument(page, consultation.id);
  expect(initial.status).toBe('preliminary');
  expect(initial.author).toEqual([
    { reference: consultation.subject.reference },
  ]);
  const document = {
    ...initial,
    status: 'amended',
    author: [{ display: 'Actual original documenter' }],
    date: '2026-01-02T09:00:00Z',
  };
  await page.evaluate(
    ({ document }) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.saveClinicalDocument(
        document,
        'integrity-patient'
      ),
    { document }
  );
  const second = await seedTestTreatment(page, { title: 'Second treatment' });
  // Link the second treatment and unlink the origin in one edit
  await openRoute(page, `/consultation/${consultation.id}/edit`);
  // The field is shown because the consultation already lists a treatment
  await page.getByTestId('link-treatment-search-input').click();
  await page
    .getByTestId(`link-treatment-autocomplete-item-${second.id}`)
    .click();
  await page.getByTestId('link-remove-treatment-button').click();
  await page.getByTestId('save-button').click();
  await expect(page).not.toHaveURL(/\/edit$/);
  const linked = await getTestClinicalDocument(page, consultation.id);
  expect(linked.author).toEqual(document.author);
  expect(linked.date).toBe(document.date);
  expect(linked.status).toBe(document.status);
  expect(findTreatmentsSection(linked).entry).toEqual([
    { reference: `MedicationRequest/${second.id}` },
  ]);
  await openRoute(page, `/treatment/${treatment.id}/edit`);
  await page
    .getByTestId('treatment-title-input')
    .fill('Renamed origin treatment');
  await page.getByTestId('save-treatment-button').click();
  await expect(page).not.toHaveURL(/\/edit$/);
  await openRoute(page, `/consultation/${consultation.id}`);
  await expect(
    page.getByTestId(`consultation-treatment-${second.id}`)
  ).toBeVisible();
  await expect(
    page.getByTestId(`consultation-treatment-${treatment.id}`)
  ).toHaveCount(0);
  const saved = await getTestTreatment(page, treatment.id);
  expect(saved.encounter.reference).toBe(`Encounter/${consultation.id}`);
});

test('recodes a development-era treatments section instead of adding another', async ({
  page,
}) => {
  const consultation = await seedTestConsultation(page, {
    title: 'Legacy section visit',
  });
  const first = await seedTestTreatment(page, {
    title: 'First',
    consultationId: consultation.id,
  });
  const initial = await getTestClinicalDocument(page, consultation.id);
  const legacy = {
    ...initial,
    section: [
      {
        ...initial.section[0],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '18605-6',
              display: 'Medication summary',
            },
            { system: 'https://example.org/local', code: 'meds' },
          ],
          text: 'Treatments',
        },
      },
    ],
  };
  const second = await seedTestTreatment(page, { title: 'Second' });
  const result = await page.evaluate(
    async ({ legacy, secondId, consultationId }) => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      await b.saveClinicalDocument(legacy, 'integrity-patient');
      await b.linkTreatmentToConsultation(
        secondId,
        consultationId,
        'integrity-patient'
      );
      return await b.getClinicalDocumentByConsultationId(consultationId);
    },
    { legacy, secondId: second.id, consultationId: consultation.id }
  );
  expect(result.section).toHaveLength(1);
  expect(result.section[0].code.coding).toEqual([
    {
      system: 'http://loinc.org',
      code: '10160-0',
      display: 'History of Medication use Narrative',
    },
    { system: 'https://example.org/local', code: 'meds' },
  ]);
  expect(result.section[0].entry).toEqual([
    { reference: `MedicationRequest/${first.id}` },
    { reference: `MedicationRequest/${second.id}` },
  ]);
});

test('new documents are authored by the patient and requesters default to the consultation specialist', async ({
  page,
}) => {
  const consultation = await seedTestConsultation(page, {
    id: 'attribution-visit',
    title: 'Attribution visit',
    doctorName: 'Encounter clinician',
  });
  await openRoute(page, `/treatment/add?consultationId=${consultation.id}`);
  await expect(page.getByTestId('treatment-requester-input')).toHaveValue(
    'Encounter clinician'
  );
  await page.getByTestId('treatment-title-input').fill('Attributed treatment');
  await page.getByTestId('save-treatment-button').click();
  await expect(page.getByTestId('treatment-title')).toHaveText(
    'Attributed treatment'
  );
  const document = await getTestClinicalDocument(page, consultation.id);
  expect(document.author).toEqual([{ reference: 'Patient/integrity-patient' }]);
  expect(document.status).toBe('preliminary');
  const [row] = await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
      "SELECT fhir_json FROM medication_requests WHERE display_label = 'Attributed treatment'"
    )
  );
  expect(JSON.parse(row.fhir_json).requester).toEqual({
    display: 'Encounter clinician',
  });
});

test('rejects conflicting or invalid dosing without saving', async ({
  page,
}) => {
  const treatment = await seedTestTreatment(page, {
    patientId: 'integrity-patient',
    title: 'Dosing guard',
    dosageInstructions: 'Original text',
  });
  const regimen = (frequency: string, frequencyMax = '') => ({
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
              frequency,
              frequencyMax,
              period: '1',
              periodUnit: 'd',
              when: '',
              boundsValue: '',
              boundsUnit: 'd',
            },
          },
        ],
      },
    ],
  });
  const attempt = (input: object) =>
    page.evaluate(
      async (input) => {
        try {
          await (window as any).__HEALTHY_TEST_BRIDGE__.updateTreatment(input);
          return null;
        } catch (error: any) {
          return error.message;
        }
      },
      {
        id: treatment.id,
        patientId: 'integrity-patient',
        title: 'Changed title',
        ...input,
      }
    );
  expect(
    await attempt({ dosageInstructions: 'Text', regimen: regimen('2') })
  ).toBe('A treatment has either dosage instructions or a regimen, not both');
  expect(await attempt({ regimen: regimen('1.5') })).toBe(
    'Min times must be a whole number'
  );
  expect(await attempt({ regimen: regimen('3', '2') })).toBe(
    'Max times must be more than min times'
  );
  expect(
    await attempt({ dispenseQuantity: { value: '-3', unit: '{tablet}' } })
  ).toBe('Quantity to dispense must be a positive number');
  expect(
    await getTestTreatment(page, treatment.id, 'integrity-patient')
  ).toEqual(treatment);
});
