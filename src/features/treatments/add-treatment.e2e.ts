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
} from '@/src/features/testing/testStorage';

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
    await page.goto('/');
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

    await checkA11y(page, { include: '[data-testid="treatment-form"]' });
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

  test('creates a treatment from a consultation and keeps it when the consultation is deleted', async ({
    page,
  }) => {
    const migraine = await seedTestCondition(page, { title: 'Migraine' });
    const headache = await seedTestCondition(page, { title: 'Headache' });
    const consultation = await seedTestConsultation(page, {
      title: 'Neurology Consultation',
      doctorName: 'Dr. Julian Bashir',
      date: '2026-03-02',
      conditionIds: [migraine.id],
      reasonConditionIds: [headache.id],
    });

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

    // Deleting the consultation keeps the treatment and clears its origin
    await page.clock.install();
    await page.getByTestId('delete-consultation-button').click();
    await expect(page.getByTestId('delete-confirmation-modal')).toBeVisible();
    await page.clock.runFor(5000);
    await page.getByTestId('delete-modal-confirm-button').click();
    await expect(page).toHaveURL(/.*(\/|#|\/\?.*)$/);
    await expect(page.getByText('Sumatriptan 50mg')).toBeVisible();

    const retained = await page.evaluate(async () => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT * FROM medication_requests WHERE display_label = ?;',
        ['Sumatriptan 50mg']
      );
    });
    expect(retained.length).toBe(1);
    expect(retained[0].consultation_id).toBeNull();
    expect(JSON.parse(retained[0].fhir_json).encounter).toBeUndefined();
  });

  test('records an optional requester on a standalone treatment', async ({
    page,
  }) => {
    await seedTestConsultation(page, {
      title: 'Earlier visit',
      doctorName: 'Dr. Known Specialist',
    });

    await page.goto('/treatment/add');
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
        "SELECT id, fhir_json FROM medication_requests WHERE display_label = 'Ibuprofen 400mg'"
      )
    );
    expect(JSON.parse(row.fhir_json).requester).toEqual({
      display: 'Dr. New Specialist',
    });

    // Removing the field clears the requester
    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('remove-treatment-requester-button').click();
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-requester')).toHaveCount(0);
    expect((await getTestTreatment(page, row.id)).requester).toBeUndefined();
  });
});

test.describe('Treatment form keyboard support', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('highlights selects and date fields on keyboard focus', async ({
    page,
  }) => {
    await page.goto('/treatment/add');
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
      await page.goto('/');
      await page.goto(route);
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
    await page.goto('/');
    await expect(page.getByTestId('floating-add-button')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByTestId('floating-add-menu')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByTestId('floating-add-menu')).toHaveCount(0);

    await page.goto('/treatment/add');
    await page.getByTestId('treatment-title-input').fill('Keyboard saved');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Keyboard saved'
    );
  });

  test('records split doses, a later phase and a dispense quantity as a structured regimen', async ({
    page,
  }) => {
    await page.goto('/treatment/add');
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

    await page.goto(`/treatment/${id}`);
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
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-treatment-usageStart').click();
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
