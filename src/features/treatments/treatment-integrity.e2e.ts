import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestTreatment,
  seedTestConsultation,
  getTestTreatment,
  getTestClinicalDocument,
  findTreatmentsSection,
  seedTestCondition,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  await seedTestPatient(page, { id: 'integrity-patient' });
});

test('optional fields can be added, removed, re-added, and cleared after reload', async ({
  page,
}) => {
  await page.goto('/treatment/add');
  await expect(page.getByTestId('treatment-status-select')).toHaveValue(
    'unknown'
  );
  for (const field of ['instructions', 'reason', 'notes']) {
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveCount(0);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId(`menu-add-treatment-${field}`).click();
    await page
      .getByTestId(`treatment-${field}-input`)
      .fill(`Original ${field}`);
    await page.getByTestId(`remove-treatment-${field}-button`).click();
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveCount(0);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId(`menu-add-treatment-${field}`).click();
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveValue('');
    await page.getByTestId(`treatment-${field}-input`).fill(`Saved ${field}`);
  }
  // An unselected reason condition saves no link
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-treatment-reasonCondition').click();
  await expect(
    page.getByTestId('treatment-reason-condition-select')
  ).toHaveValue('');
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
  await page.goto(`/treatment/${rows[0].id}/edit`);
  for (const field of ['instructions', 'reason', 'notes']) {
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveValue(
      `Saved ${field}`
    );
    await page.getByTestId(`remove-treatment-${field}-button`).click();
  }
  await page.getByTestId('save-treatment-button').click();
  await expect(page).not.toHaveURL(/\/edit$/);
  await page.goto(`/treatment/${rows[0].id}/edit`);
  for (const field of ['instructions', 'reason', 'notes']) {
    await expect(page.getByTestId(`treatment-${field}-input`)).toHaveCount(0);
  }
  const saved = await getTestTreatment(page, rows[0].id);
  expect(saved.reason).toBeUndefined();
  expect(saved.note).toBeUndefined();
  expect(saved.dosageInstruction).toBeUndefined();
  expect(saved.status).toBe('unknown');
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
  await page.goto('/treatment/imported-request/edit');
  await expect(page.getByTestId('treatment-intent-select')).toHaveValue(
    'proposal'
  );
  await expect(page.getByTestId('treatment-status-select')).toHaveValue(
    'ended'
  );
  await page.getByTestId('treatment-title-input').fill('Edited request');
  await page.getByTestId('remove-treatment-instructions-button').click();
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
  expect(saved.dosageInstruction[0]).toEqual({
    route: resource.dosageInstruction[0].route,
    timing: resource.dosageInstruction[0].timing,
  });
  expect(saved.dosageInstruction[1]).toEqual(resource.dosageInstruction[1]);
  expect(saved.reason[0]).toEqual({
    concept: { coding: resource.reason[0].concept.coding },
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
  expect(initial.author).toEqual([{ display: 'Synthetic test documenter' }]);
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
  await page.goto(`/consultation/${consultation.id}`);
  await page.getByTestId('consultation-add-treatment').click();
  await page.getByTestId('option-link-existing-treatment').click();
  await expect(page.getByTestId('link-documenter-input')).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Link existing treatment' })
    .selectOption(second.id);
  await expect(
    page.getByTestId(`consultation-treatment-${second.id}`)
  ).toBeVisible();
  const linked = await getTestClinicalDocument(page, consultation.id);
  expect(linked.author).toEqual(document.author);
  expect(linked.date).toBe(document.date);
  expect(linked.status).toBe(document.status);
  await page.getByTestId(`unlink-treatment-${treatment.id}`).click();
  await expect(
    page.getByTestId(`consultation-treatment-${treatment.id}`)
  ).toHaveCount(0);
  await page.goto(`/treatment/${treatment.id}/edit`);
  await page
    .getByTestId('treatment-title-input')
    .fill('Renamed origin treatment');
  await page.getByTestId('save-treatment-button').click();
  await expect(page).not.toHaveURL(/\/edit$/);
  await page.goto(`/consultation/${consultation.id}`);
  await expect(
    page.getByTestId(`consultation-treatment-${second.id}`)
  ).toBeVisible();
  await expect(
    page.getByTestId(`consultation-treatment-${treatment.id}`)
  ).toHaveCount(0);
  const saved = await getTestTreatment(page, treatment.id);
  expect(saved.encounter.reference).toBe(`Encounter/${consultation.id}`);
});

test('failed reference cleanup rolls back deletion and tombstones; retry cleans nested sections', async ({
  page,
}) => {
  const consultation = await seedTestConsultation(page, {
    title: 'Rollback visit',
  });
  const treatment = await seedTestTreatment(page, {
    title: 'Rollback treatment',
    consultationId: consultation.id,
  });
  const initial = await getTestClinicalDocument(page, consultation.id);
  initial.section.push({
    title: 'Nested section',
    text: {
      status: 'additional',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Keep narrative</div>',
    },
    section: [
      {
        title: 'Nested entries',
        entry: [{ reference: `MedicationRequest/${treatment.id}` }],
      },
    ],
  });
  const result = await page.evaluate(
    async ({ initial, treatmentId }) => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      await b.saveClinicalDocument(initial, 'integrity-patient');
      const pendingBefore = await b.getPendingDeletedClinicalResources();
      await b.executeSql(
        "CREATE TRIGGER fail_treatment_cleanup BEFORE UPDATE ON clinical_documents BEGIN SELECT RAISE(ABORT, 'Synthetic cleanup failure'); END"
      );
      let failed = false;
      try {
        await b.deleteTreatment(treatmentId, 'integrity-patient');
      } catch {
        failed = true;
      }
      const retained = await b.getTreatment(treatmentId, 'integrity-patient');
      const pendingAfter = await b.getPendingDeletedClinicalResources();
      const retainedDocument = await b.getClinicalDocumentByConsultationId(
        initial.encounter.reference.slice(10)
      );
      await b.executeSql('DROP TRIGGER fail_treatment_cleanup');
      await b.deleteTreatment(treatmentId, 'integrity-patient');
      return {
        failed,
        retained,
        pendingBefore,
        pendingAfter,
        retainedDocument,
        document: await b.getClinicalDocumentByConsultationId(
          initial.encounter.reference.slice(10)
        ),
      };
    },
    { initial, treatmentId: treatment.id }
  );
  expect(result.failed).toBe(true);
  expect(result.retained.id).toBe(treatment.id);
  expect(result.pendingAfter).toEqual(result.pendingBefore);
  expect(result.retainedDocument).toEqual(initial);
  // Emptied sections are dropped (R5 cmp-1); a parent with text is kept
  expect(findTreatmentsSection(result.document)).toBeUndefined();
  const nested = result.document.section.at(-1);
  expect(nested.title).toBe('Nested section');
  expect(nested.text).toEqual(initial.section.at(-1).text);
  expect(nested.section).toBeUndefined();
});

test('deleting a reason condition keeps the treatment, its wording and editability', async ({
  page,
}) => {
  const condition = await seedTestCondition(page, { title: 'Migraine' });
  const treatment = await seedTestTreatment(page, {
    title: 'Sumatriptan 50mg',
    reason: 'Migraine attacks',
    reasonConditionId: condition.id,
  });
  await page.evaluate(
    (id) => (window as any).__HEALTHY_TEST_BRIDGE__.deleteCondition(id),
    condition.id
  );
  const cleaned = await getTestTreatment(page, treatment.id);
  expect(cleaned.reason).toEqual([{ concept: { text: 'Migraine attacks' } }]);
  expect(cleaned.meta.lastUpdated > treatment.meta.lastUpdated).toBe(true);

  await page.goto(`/treatment/${treatment.id}/edit`);
  await page.getByTestId('treatment-title-input').fill('Sumatriptan 100mg');
  await page.getByTestId('save-treatment-button').click();
  await expect(page.getByTestId('treatment-title')).toHaveText(
    'Sumatriptan 100mg'
  );
  await expect(page.getByTestId('treatment-reason-section')).toContainText(
    'Migraine attacks'
  );
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

test('switching patients unmounts edit fields and restores the correct form on return', async ({
  page,
}) => {
  const treatment = await seedTestTreatment(page, {
    title: 'First patient private treatment',
  });
  await page.goto(`/treatment/${treatment.id}/edit`);
  await expect(page.getByTestId('treatment-title-input')).toHaveValue(
    'First patient private treatment'
  );
  await page.getByTestId('treatment-title-input').fill('Unsaved private draft');
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.seedPatient({
      id: 'second-integrity-patient',
      givenName: 'Second',
    })
  );
  await expect(page.getByTestId('edit-treatment-not-found')).toBeVisible();
  await expect(page.getByTestId('treatment-title-input')).toHaveCount(0);
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.setActivePatient(
      'integrity-patient'
    )
  );
  await expect(page.getByTestId('treatment-title-input')).toHaveValue(
    'First patient private treatment'
  );
});

test('new documents require explicit attribution and failed links roll back requests', async ({
  page,
}) => {
  const consultation = await seedTestConsultation(page, {
    id: 'attribution-visit',
    title: 'Attribution visit',
    doctorName: 'Encounter clinician',
  });
  const failed = await page.evaluate(async () => {
    const b = (window as any).__HEALTHY_TEST_BRIDGE__;
    let message = '';
    try {
      await b.updateTreatment({
        id: 'unattributed',
        patientId: 'integrity-patient',
        consultationId: 'attribution-visit',
        title: 'Missing author',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    return {
      message,
      request: await b.getTreatment('unattributed'),
      document:
        await b.getClinicalDocumentByConsultationId('attribution-visit'),
    };
  });
  expect(failed.message).toContain('Documenter name is required');
  expect(failed.request).toBeNull();
  expect(failed.document).toBeNull();
  await page.goto(`/treatment/add?consultationId=${consultation.id}`);
  await page.getByTestId('treatment-title-input').fill('Attributed treatment');
  await page.getByTestId('save-treatment-button').click();
  await expect(page.getByTestId('treatment-form-error')).toContainText(
    'Documenter name is required'
  );
  await page
    .getByTestId('treatment-documenter-input')
    .fill('Actual documenter');
  await page.getByTestId('save-treatment-button').click();
  await expect(page).toHaveURL(new RegExp(`/consultation/${consultation.id}$`));
  const document = await getTestClinicalDocument(page, consultation.id);
  expect(document.author).toEqual([{ display: 'Actual documenter' }]);
  expect(document.status).toBe('preliminary');
});

test('rejects foreign reason and consultation references without saving', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'foreign-reference-patient' });
  await page.evaluate(async () => {
    const b = (window as any).__HEALTHY_TEST_BRIDGE__;
    await b.seedCondition({
      id: 'foreign-reason',
      patientId: 'foreign-reference-patient',
      title: 'Foreign condition',
    });
    await b.seedConsultation({
      id: 'foreign-visit',
      patientId: 'foreign-reference-patient',
      title: 'Foreign visit',
    });
  });
  const attempts = await page.evaluate(async () => {
    const b = (window as any).__HEALTHY_TEST_BRIDGE__;
    const errors = [];
    for (const input of [
      { reasonConditionId: 'foreign-reason' },
      { consultationId: 'foreign-visit', documenterName: 'Actual documenter' },
    ]) {
      try {
        await b.updateTreatment({
          id: 'foreign-link-request',
          patientId: 'integrity-patient',
          title: 'Rejected reference',
          ...input,
        });
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    return { errors, request: await b.getTreatment('foreign-link-request') };
  });
  expect(attempts.errors).toHaveLength(2);
  expect(attempts.request).toBeNull();
});
