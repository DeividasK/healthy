import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  getTestTreatment,
  findTreatmentsSection,
  getTestClinicalDocument,
  getTestTreatmentUsage,
  getBrowserLocalDate,
  checkA11y,
  openRoute,
  seedTestTreatment,
  seedTestBundle,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';
import { getBundleMemberIds } from '@/src/features/bundles/bundleModel';

test.describe('Add Treatment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('creates a standalone treatment from Home with every optional field', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      title: 'Acute sinusitis',
    });
    await openRoute(page, '/');
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-treatment').click();
    await expect(page).toHaveURL(/.*treatment\/add$/);

    // Empty submission fails
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-form-error')).toContainText(
      'Treatment name is required'
    );

    await page
      .getByTestId('treatment-title-input')
      .fill('Amoxicillin 500mg Capsule');
    await page.getByTestId('treatment-intent-select').selectOption('order');
    await page.getByTestId('treatment-status-select').selectOption('active');

    for (const field of [
      'instructions',
      'reason',
      'reasonCondition',
      'notes',
    ]) {
      await page.getByTestId('add-option-button').click();
      await page.getByTestId(`menu-add-treatment-${field}`).click();
      await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
    }
    const multiLineInstructions =
      'Take 1 capsule by mouth every 8 hours with meals for 10 days.\nDo not skip doses.\nComplete full course.';
    await page
      .getByTestId('treatment-instructions-input')
      .fill(multiLineInstructions);
    await page
      .getByTestId('treatment-reason-input')
      .fill('Acute bacterial sinusitis');
    await page.getByTestId('treatment-condition-search-input').click();
    await page
      .getByTestId(`treatment-condition-autocomplete-item-${condition.id}`)
      .click();
    await page
      .getByTestId('treatment-notes-input')
      .fill('Patient reported no penicillin allergies.');

    await page.getByTestId('save-treatment-button').click();

    // Opens the new treatment
    await expect(page).toHaveURL(/\/treatment\/[^/]+$/);
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Amoxicillin 500mg Capsule'
    );
    await expect(page.getByTestId('treatment-intent')).toContainText(
      'Prescription'
    );
    await expect(page.getByTestId('treatment-dosage')).toContainText(
      'Complete full course.'
    );
    // Wording and the linked Condition are both shown
    await expect(page.getByTestId('treatment-reason-section')).toContainText(
      'Acute bacterial sinusitis'
    );
    await expect(
      page.getByTestId('treatment-reason-conditions-section')
    ).toContainText('Acute sinusitis');
    await expect(page.getByTestId('treatment-notes-section')).toContainText(
      'Patient reported no penicillin allergies.'
    );

    const id = page.url().split('/').pop()!;
    const stored = await getTestTreatment(page, id);
    expect(stored.reason).toEqual([
      { concept: { text: 'Acute bacterial sinusitis' } },
      { reference: { reference: `Condition/${condition.id}` } },
    ]);
    expect(stored.text.status).toBe('generated');
    expect(stored.text.div).toContain('Amoxicillin 500mg Capsule');
  });

  test('fills a new treatment from an AI reply', async ({ page }) => {
    await openRoute(page, '/treatment/add');
    await page.getByTestId('import-with-ai-button').click();
    await page.getByTestId('ai-import-reply-input').fill(
      JSON.stringify({
        healthyTreatment: 1,
        name: 'Prednisolone 5 mg tablets',
        intent: 'order',
        status: 'active',
        date: '2025-03-10',
        requester: 'Dr. Sarah Adams',
        regimen: [
          {
            doses: [
              {
                amount: 2,
                unit: 'tablet',
                route: 'Oral',
                times: 1,
                timeOfDay: 'MORN',
                courseLength: 5,
                courseUnit: 'd',
                instructions: 'Take with food',
              },
            ],
          },
          { doses: [{ amount: 1, unit: 'tablet', times: 1, timesMax: 2 }] },
        ],
        quantity: { value: 30, unit: 'tablets' },
        reason: 'Asthma flare-up',
      })
    );
    await page.getByTestId('ai-import-submit-button').click();
    await expect(page.getByTestId('ai-import-modal-card')).toHaveCount(0);

    await expect(page.getByTestId('treatment-title-input')).toHaveValue(
      'Prednisolone 5 mg tablets'
    );
    await expect(page.getByTestId('treatment-intent-select')).toHaveValue(
      'order'
    );
    await expect(
      page.getByTestId('treatment-date-picker').locator('input')
    ).toHaveValue('2025-03-10');
    await expect(page.getByTestId('treatment-requester-input')).toHaveValue(
      'Dr. Sarah Adams'
    );
    await expect(
      page.getByTestId('treatment-regimen-p1-d1-amount-input')
    ).toHaveValue('2');
    await expect(
      page.getByTestId('treatment-regimen-p2-d1-frequency-input')
    ).toHaveValue('1');
    await expect(
      page.getByTestId('treatment-dispenseQuantity-input')
    ).toHaveValue('30');
    await expect(page.getByTestId('treatment-reason-input')).toHaveValue(
      'Asthma flare-up'
    );

    await page.getByTestId('save-treatment-button').click();
    await expect(page).toHaveURL(/\/treatment\/[^/]+$/);
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      [
        'Phase 1: 2 tablets oral in the morning, for 5 days. Take with food',
        'Phase 2: 1 tablet, 1–2 times a day',
      ].join('\n')
    );
    const stored = await getTestTreatment(page, page.url().split('/').pop()!);
    expect(stored.authoredOn.slice(0, 10)).toBe('2025-03-10');
    expect(stored.dosageInstruction[0].patientInstruction).toBe(
      'Take with food'
    );
    expect(stored.dispenseRequest.quantity).toMatchObject({
      value: 30,
      code: '{tablet}',
    });
  });

  test('creates a treatment from a consultation, then edits and deletes it', async ({
    page,
  }) => {
    const migraine = await seedTestCondition(page, { title: 'Migraine' });
    const headache = await seedTestCondition(page, { title: 'Headache' });
    const nausea = await seedTestCondition(page, { title: 'Nausea' });
    const consultation = await seedTestConsultation(page, {
      title: 'Neurology Consultation',
      doctorName: 'Dr. Julian Bashir',
      date: '2026-03-02',
      conditionIds: [migraine.id],
      reasonConditionIds: [headache.id],
    });

    // A full load: browser back below needs the history it builds.
    await page.goto(`/consultation/${consultation.id}`);
    await page.getByTestId('consultation-add-treatment').click();
    await page.getByTestId('option-create-new-treatment').click();
    await expect(page).toHaveURL(
      new RegExp(`.*treatment\\/add\\?consultationId=${consultation.id}`)
    );

    await page.getByTestId('treatment-title-input').fill('Sumatriptan 50mg');
    await page.getByTestId('treatment-intent-select').selectOption('order');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-treatment-instructions').click();
    await expect(page.getByTestId('treatment-requester-input')).toHaveValue(
      'Dr. Julian Bashir'
    );
    await page
      .getByTestId('treatment-instructions-input')
      .fill('Take 1 tablet at onset of migraine.');
    await page.getByTestId('save-treatment-button').click();

    // Opens the new treatment; going back returns to the consultation
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Sumatriptan 50mg'
    );
    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}$`)
    );
    await expect(
      page.getByTestId('consultation-treatments').getByText('Sumatriptan 50mg')
    ).toBeVisible();

    // Origin is stored in FHIR and projected to SQL; the document links it
    const rows = await page.evaluate(async () => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT * FROM medication_requests WHERE display_label = ?;',
        ['Sumatriptan 50mg']
      );
    });
    expect(rows.length).toBe(1);
    expect(rows[0].consultation_id).toBe(consultation.id);
    const created = JSON.parse(rows[0].fhir_json);
    expect(created.encounter?.reference).toBe(`Encounter/${consultation.id}`);
    expect(created.requester).toEqual({ display: 'Dr. Julian Bashir' });
    // The date defaults to the consultation's.
    expect(created.authoredOn).toBe('2026-03-02');
    // The consultation's diagnoses and reasons for visit become its reasons.
    expect(created.reason).toEqual([
      { reference: { reference: `Condition/${migraine.id}` } },
      { reference: { reference: `Condition/${headache.id}` } },
    ]);
    const doc = await getTestClinicalDocument(page, consultation.id);
    expect(doc.author).toEqual([{ reference: consultation.subject.reference }]);
    const section = findTreatmentsSection(doc);
    expect(section.code.coding[0]).toEqual({
      system: 'http://loinc.org',
      code: '10160-0',
      display: 'History of Medication use Narrative',
    });
    expect(section.entry).toEqual([
      { reference: `MedicationRequest/${created.id}` },
    ]);

    // Deleting the consultation instead is covered by record-integrity.
    expect(created.text.div).toContain('Sumatriptan 50mg');

    await test.step('Edit its name, status, reason and associated conditions', async () => {
      await openRoute(page, `/treatment/${created.id}`);
      await page.getByTestId('edit-treatment-button').click();
      await expect(page).toHaveURL(new RegExp(`treatment/${created.id}/edit$`));
      // Importing with AI only fills in new treatments.
      await expect(page.getByTestId('import-with-ai-button')).toHaveCount(0);
      await expect(
        page.getByTestId(`treatment-selected-condition-${migraine.id}`)
      ).toBeVisible();
      await page.getByTestId('treatment-title-input').fill('Rizatriptan 10mg');
      await page
        .getByTestId('treatment-status-select')
        .selectOption('completed');
      await page.getByTestId('add-option-button').click();
      await page.getByTestId('menu-add-treatment-reason').click();
      await page.getByTestId('treatment-reason-input').fill('Acute attacks');
      await page.getByTestId('treatment-condition-search-input').click();
      await page
        .getByTestId(`treatment-condition-autocomplete-item-${nausea.id}`)
        .click();
      await checkA11y(page, { include: '[data-testid="treatment-form"]' });
      await page.getByTestId('save-treatment-button').click();

      await expect(page.getByTestId('treatment-title')).toHaveText(
        'Rizatriptan 10mg'
      );
      // The meta line shows the status first; the origin row may repeat it.
      await expect(
        page.getByTestId('treatment-view').getByText('Completed').first()
      ).toBeVisible();
      const section = page.getByTestId('treatment-reason-conditions-section');
      for (const title of ['Migraine', 'Headache', 'Nausea'])
        await expect(section).toContainText(title);
      // The narrative is regenerated from the edited treatment.
      const edited = await getTestTreatment(page, created.id);
      expect(edited.status).toBe('completed');
      expect(edited.text.div).toContain('Rizatriptan 10mg');
      expect(edited.text.div).not.toContain('Sumatriptan');
      // The wording lives on the first reason, beside its condition.
      expect(edited.reason[0].concept).toEqual({ text: 'Acute attacks' });
      expect(
        edited.reason.map((reason: any) => reason.reference?.reference)
      ).toEqual([
        `Condition/${migraine.id}`,
        `Condition/${headache.id}`,
        `Condition/${nausea.id}`,
      ]);

      // Removing one condition keeps the others
      await page.getByTestId('edit-treatment-button').click();
      await page.getByTestId('treatment-remove-condition-button').click();
      await page.getByTestId('save-treatment-button').click();
      await expect(section).not.toContainText('Migraine');
      await expect(section).toContainText('Nausea');

      // Removing the field clears only the links; the wording stays
      await page.getByTestId('edit-treatment-button').click();
      await page.getByTestId('remove-treatment-reasonCondition-button').click();
      await page.getByTestId('save-treatment-button').click();
      await expect(section).toHaveCount(0);
      const cleared = await getTestTreatment(page, created.id);
      expect(cleared.reason).toEqual([{ concept: { text: 'Acute attacks' } }]);
    });

    await test.step('Delete it and drop its now-empty document section', async () => {
      await page.clock.install();
      await page.getByTestId('delete-treatment-button').click();
      await page.clock.runFor(5000);
      await page.getByTestId('delete-modal-confirm-button').click();
      await expect(page).not.toHaveURL(/\/treatment\//);
      await expect(page.getByText('Rizatriptan 10mg')).toHaveCount(0);
      // The document remains, but an empty section would violate R5 cmp-1
      const docAfter = await getTestClinicalDocument(page, consultation.id);
      expect(docAfter).toBeDefined();
      expect(findTreatmentsSection(docAfter)).toBeUndefined();
    });
  });

  test('records an optional requester on a standalone treatment', async ({
    page,
  }) => {
    await seedTestConsultation(page, {
      title: 'Earlier visit',
      doctorName: 'Dr. Known Specialist',
    });

    await openRoute(page, '/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Ibuprofen 400mg');
    await expect(page.getByTestId('treatment-requester-input')).toHaveCount(0);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-treatment-requester').click();
    const requester = page.getByTestId('treatment-requester-input');
    await requester.click();
    await expect(
      page.getByTestId('treatment-requester-input-autocomplete-item-0')
    ).toHaveText('Dr. Known Specialist');
    // Focusing out closes the suggestions
    await page.getByTestId('treatment-title-input').click();
    await expect(
      page.getByTestId('treatment-requester-input-autocomplete-list')
    ).toHaveCount(0);

    // A specialist not seen before can be entered
    await requester.fill('Dr. New Specialist');
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-requester')).toContainText(
      'Dr. New Specialist'
    );
    const [row] = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        "SELECT fhir_json FROM medication_requests WHERE display_label = 'Ibuprofen 400mg'"
      )
    );
    expect(JSON.parse(row.fhir_json).requester).toEqual({
      display: 'Dr. New Specialist',
    });
  });
});

test.describe('Treatment form keyboard support', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('highlights selects and date fields on keyboard focus', async ({
    page,
  }) => {
    await openRoute(page, '/treatment/add');
    const outline = (testID: string) =>
      page
        .getByTestId(testID)
        .evaluate((element) => getComputedStyle(element).outlineStyle);

    await page.getByTestId('treatment-title-input').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('treatment-intent-select')).toBeFocused();
    expect(await outline('treatment-intent-select')).toBe('solid');

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('treatment-status-select')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#treatment-date-input')).toBeFocused();
    // The visible wrapper carries the highlight for the hidden date input.
    expect(await outline('treatment-date-picker')).toBe('solid');
    expect(await outline('treatment-intent-select')).toBe('none');
  });

  test('new-resource forms focus their first field and Escape cancels them when pristine', async ({
    page,
  }) => {
    const forms = [
      ['/treatment/add', 'treatment-title-input'],
      ['/condition/add', 'condition-title-input'],
      ['/consultation/add', 'consultation-title-input'],
      ['/lab-result/add', 'test-search-input'],
      ['/profile/new', 'patient-given-name-input'],
    ];
    for (const [route, firstField] of forms) {
      await openRoute(page, route);
      await expect(page.getByTestId(firstField)).toBeFocused();
      if (route !== '/profile/new' && route !== '/lab-result/add') {
        await expect(page.locator(`[id="${firstField}-label"]`)).toContainText(
          '*'
        );
      }
      if (route === '/treatment/add') {
        for (const id of [
          'treatment-intent-select',
          'treatment-status-select',
          'treatment-date-input',
        ]) {
          await expect(page.locator(`[id="${id}-label"]`)).toContainText('*');
        }
      }
      // Profiles can only be cancelled once existing ones have loaded.
      await expect(page.getByTestId('cancel-button')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByTestId('discard-changes-modal')).toHaveCount(0);
    }
  });

  test('Cmd/Ctrl+Enter runs the primary island action', async ({ page }) => {
    // + comes with the first record.
    await seedTestCondition(page, { title: 'Asthma' });
    await openRoute(page, '/');
    await expect(page.getByTestId('floating-add-button')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByTestId('floating-add-menu')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByTestId('floating-add-menu')).toHaveCount(0);

    await openRoute(page, '/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Keyboard saved');
    // The shared dock switches to the form once the form has focus.
    await expect(page.getByTestId('save-treatment-button')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Keyboard saved'
    );
  });

  test('records split doses, a later phase and a dispense quantity as a structured regimen', async ({
    page,
  }) => {
    await openRoute(page, '/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Prednisolone 5mg');
    const openMenu = async () => {
      await page.getByTestId('add-option-button').click();
      await expect(page.getByTestId('form-add-menu')).toBeVisible();
    };
    const addField = async (field: string) => {
      await openMenu();
      await page.getByTestId(`menu-add-treatment-${field}`).click();
      await expect(page.getByTestId('form-add-menu')).toHaveCount(0);
    };
    await addField('regimen');
    // The added regimen's first field takes focus, prefilled as 1 tablet
    // once a day
    await expect(
      page.getByTestId('treatment-regimen-p1-d1-amount-input')
    ).toBeFocused();
    await expect(
      page.getByTestId('treatment-regimen-p1-d1-amount-input')
    ).toHaveValue('1');
    await expect(
      page.getByTestId('treatment-regimen-p1-d1-frequency-input')
    ).toHaveValue('1');
    // Text instructions and a regimen are alternatives
    await openMenu();
    await expect(
      page.getByTestId('menu-add-treatment-instructions')
    ).toHaveCount(0);
    await page.getByTestId('menu-add-treatment-dispenseQuantity').click();
    await expect(page.getByTestId('form-add-menu')).toHaveCount(0);

    const dose = (phase: number, index: number, field: string) =>
      page.getByTestId(`treatment-regimen-p${phase}-d${index}-${field}`);
    // A phase's + adds doses and phases; a dose's + adds its optional
    // fields, both from a centered menu.
    const addFrom = async (button: string, option: string) => {
      await page.getByTestId(`treatment-regimen-${button}-add`).click();
      await page.getByTestId(`treatment-regimen-option-${option}`).click();
      await expect(page.getByTestId('regimen-options-menu')).toHaveCount(0);
    };
    await dose(1, 1, 'amount-input').fill('2');
    await dose(1, 1, 'frequency-input').fill('1');
    // Escape (Android back) closes only the open menu, not the form
    await page.getByTestId('treatment-regimen-p1-d1-add').click();
    await expect(page.getByTestId('regimen-options-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('regimen-options-menu')).toHaveCount(0);
    await expect(page.getByTestId('discard-changes-modal')).toHaveCount(0);
    await expect(dose(1, 1, 'amount-input')).toHaveValue('2');
    await addFrom('p1-d1', 'route');
    await expect(dose(1, 1, 'route-select')).toHaveValue('26643006');
    await addFrom('p1-d1', 'when');
    await expect(dose(1, 1, 'when-select')).toBeFocused();
    await dose(1, 1, 'when-select').selectOption('MORN');
    // A part of the day needs no clock time
    await expect(
      page.locator('#treatment-regimen-p1-d1-timeOfDay-input')
    ).toHaveCount(0);
    await addFrom('p1-d1', 'bounds');
    await dose(1, 1, 'boundsValue-input').fill('7');
    // A removed optional field goes back to the menu
    await dose(1, 1, 'bounds-remove').click();
    await expect(dose(1, 1, 'boundsValue-input')).toHaveCount(0);
    await addFrom('p1-d1', 'bounds');
    await expect(dose(1, 1, 'boundsValue-input')).toHaveValue('');
    await dose(1, 1, 'boundsValue-input').fill('7');

    // Duplicating copies every value into a new dose right after it, e.g. the
    // same again in the evening
    await page.getByTestId('treatment-regimen-p1-d1-duplicate').click();
    await expect(dose(1, 2, 'amount-input')).toHaveValue('2');
    await expect(dose(1, 2, 'frequency-input')).toHaveValue('1');
    await expect(dose(1, 2, 'route-select')).toHaveValue('26643006');
    await expect(dose(1, 2, 'when-select')).toHaveValue('MORN');
    await expect(dose(1, 2, 'boundsValue-input')).toHaveValue('7');
    await dose(1, 2, 'amount-input').fill('1');
    await dose(1, 2, 'when-select').selectOption('EVE');
    // Or at a specific clock time instead of a part of the day
    await dose(1, 2, 'when-select').selectOption({
      label: 'At a specific time',
    });
    await page
      .locator('#treatment-regimen-p1-d2-timeOfDay-input')
      .fill('20:30');
    // Another dose starts as 1 tablet once a day and takes focus
    await addFrom('p1', 'dose');
    await expect(dose(1, 3, 'amount-input')).toBeFocused();
    await expect(dose(1, 3, 'amount-input')).toHaveValue('1');
    await expect(dose(1, 3, 'frequency-input')).toHaveValue('1');
    await dose(1, 3, 'remove').click();

    await addFrom('p1', 'phase');
    await dose(2, 1, 'amount-input').fill('1');
    await dose(2, 1, 'frequency-input').fill('3');
    await addFrom('p2-d1', 'frequencyMax');
    await dose(2, 1, 'frequencyMax-input').fill('2');
    await page.getByTestId('treatment-dispenseQuantity-input').fill('30');

    // An inverted frequency range is refused before anything is written
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-form-error')).toHaveText(
      'Phase 2: Max times must be more than min times'
    );
    const countRows = () =>
      page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
          'SELECT id FROM medication_requests'
        )
      );
    expect(await countRows()).toHaveLength(0);

    await dose(2, 1, 'frequency-input').fill('1');
    await checkA11y(page, { include: '[data-testid="treatment-form"]' });
    await page.getByTestId('save-treatment-button').click();
    await expect(page).not.toHaveURL(/treatment\/add/);

    const [{ id }] = await countRows();
    const stored = await getTestTreatment(page, id);
    const dosages = stored.dosageInstruction;
    expect(dosages.map((dosage: any) => dosage.sequence)).toEqual([1, 1, 2]);
    expect(dosages.some((dosage: any) => 'text' in dosage)).toBe(false);
    expect(dosages[0].doseAndRate[0].doseQuantity).toEqual({
      value: 2,
      unit: 'tablet',
      system: 'http://unitsofmeasure.org',
      code: '{tablet}',
    });
    expect(dosages[0].route.coding[0].code).toBe('26643006');
    expect(dosages[0].timing.repeat).toMatchObject({
      frequency: 1,
      period: 1,
      periodUnit: 'd',
      when: ['MORN'],
    });
    expect(dosages[1].timing.repeat.timeOfDay).toEqual(['20:30:00']);
    expect(dosages[1].timing.repeat.when).toBeUndefined();
    expect(dosages[1].timing.repeat.boundsDuration).toMatchObject({
      value: 7,
      code: 'd',
    });
    expect(dosages[2].timing.repeat).toEqual({
      frequency: 1,
      frequencyMax: 2,
      period: 1,
      periodUnit: 'd',
    });
    expect(stored.dispenseRequest.quantity).toMatchObject({
      value: 30,
      code: '{tablet}',
    });

    await openRoute(page, `/treatment/${id}`);
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      [
        'Phase 1: 2 tablets oral in the morning, for 7 days',
        'Phase 1: 1 tablet oral at 20:30, for 7 days',
        'Phase 2: 1 tablet, 1–2 times a day',
      ].join('\n')
    );
    await expect(page.getByTestId('treatment-dispense-quantity')).toHaveText(
      '30 tablets'
    );
  });

  test('starts taking a new treatment from a chosen day, not before its date', async ({
    page,
  }) => {
    const [lastWeek, today, nextWeek] = await Promise.all(
      [-7, 0, 7].map((offset) => getBrowserLocalDate(page, offset))
    );
    await page.goto('/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Vitamin D');
    // Start taking is shown from the start, as today
    const usageStart = page
      .getByTestId('treatment-usageStart-picker')
      .locator('input');
    await expect(usageStart).toHaveValue(today);
    await checkA11y(page, { include: '[data-testid="treatment-form"]' });

    // Taking it cannot start before the treatment's date
    await usageStart.fill(lastWeek);
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-form-error')).toHaveText(
      "Start taking cannot be before the treatment's date"
    );

    // It can start on a day still to come
    await usageStart.fill(nextWeek);
    await page.getByTestId('save-treatment-button').click();
    await expect(page).toHaveURL(/\/treatment\/[^/]+$/);
    await expect(page.getByTestId('treatment-usage-section')).toBeVisible();
    const id = new URL(page.url()).pathname.split('/').pop()!;
    const statements = await getTestTreatmentUsage(page, id);
    expect(statements).toHaveLength(1);
    expect(statements[0].effectivePeriod).toEqual({ start: nextWeek });
    expect(statements[0].adherence.code.coding[0].code).toBe('taking');
  });
});

test.describe('Add Treatment bundles', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('adds a new treatment to existing bundles', async ({ page }) => {
    const [vitaminD, omega3] = await Promise.all(
      ['Vitamin D', 'Omega-3'].map((title) =>
        seedTestTreatment(page, { title })
      )
    );
    const [morning, evening] = await Promise.all(
      [
        ['Morning stack', vitaminD.id],
        ['Evening stack', omega3.id],
      ].map(([title, id]) => seedTestBundle(page, { title, memberIds: [id] }))
    );
    await openRoute(page, '/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Magnesium');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-bundle').click();
    await page.getByTestId('link-bundle-search-input').click();
    await page
      .getByTestId(`link-bundle-autocomplete-item-${morning.id}`)
      .click();
    await expect(
      page.getByTestId(`link-selected-bundle-${morning.id}`)
    ).toBeVisible();
    await page.getByTestId('save-treatment-button').click();

    await expect(page).toHaveURL(/\/treatment\/[^/]+$/);
    await expect(
      page.getByTestId(`treatment-bundle-${morning.id}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`treatment-bundle-${evening.id}`)
    ).toHaveCount(0);
    const id = new URL(page.url()).pathname.split('/').pop()!;
    const stored = await Promise.all(
      [morning.id, evening.id].map((bundleId) =>
        bridge(page, (b, bundleId) => b.getBundle(bundleId), bundleId)
      )
    );
    expect(stored.map(getBundleMemberIds)).toEqual([
      [vitaminD.id, id],
      [omega3.id],
    ]);
  });

  test('offers no bundle field when there are no bundles', async ({ page }) => {
    await openRoute(page, '/treatment/add');
    await page.getByTestId('add-option-button').click();
    await expect(page.getByTestId('form-add-menu')).toBeVisible();
    await expect(page.getByTestId('menu-link-bundle')).toHaveCount(0);
  });

  test('allows one bundle per dose of the regimen', async ({ page }) => {
    // Tall enough for the whole form, so its lists never open behind the dock.
    await page.setViewportSize({ width: 1280, height: 1600 });
    const [vitaminD, omega3] = await Promise.all(
      ['Vitamin D', 'Omega-3'].map((title) =>
        seedTestTreatment(page, { title })
      )
    );
    const [morning, evening] = await Promise.all(
      [
        ['Morning stack', vitaminD.id],
        ['Evening stack', omega3.id],
      ].map(([title, id]) => seedTestBundle(page, { title, memberIds: [id] }))
    );
    await openRoute(page, '/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Magnesium');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-bundle').click();
    const search = page.getByTestId('link-bundle-search-input');
    const pick = async (id: string) => {
      await search.click();
      await page.getByTestId(`link-bundle-autocomplete-item-${id}`).click();
    };
    // Without a regimen, one bundle.
    await pick(morning.id);
    await expect(search).toHaveCount(0);

    // A regimen with two doses can be in two bundles.
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-treatment-regimen').click();
    const field = (id: string) => page.getByTestId(`treatment-regimen-${id}`);
    await field('p1-add').click();
    await field('option-dose').click();
    await expect(search).toBeVisible();
    await pick(evening.id);
    await expect(search).toHaveCount(0);

    // Back to one dose, two bundles are too many.
    await field('p1-d2-remove').click();
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-form-error')).toHaveText(
      'A treatment with one dose can be in only one bundle'
    );
  });
});
