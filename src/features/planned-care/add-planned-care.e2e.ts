import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  getTestPlannedCare,
  getTestClinicalDocument,
  findPlannedCareSection,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Add Planned Care Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('creates standalone planned care from Home with every optional field', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      title: 'Gallstones',
    });
    await page.goto('/');
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-planned-care').click();
    await expect(page).toHaveURL(/.*planned-care\/add$/);

    await page.getByTestId('save-planned-care-button').click();
    await expect(page.getByTestId('planned-care-form-error')).toContainText(
      'Service is required'
    );

    await page
      .getByTestId('planned-care-title-input')
      .fill('Abdominal ultrasound');
    await page
      .getByTestId('planned-care-category-select')
      .selectOption('363679005');
    await page.getByTestId('planned-care-intent-select').selectOption('order');
    await page.getByTestId('planned-care-status-select').selectOption('active');

    for (const field of [
      'plannedDate',
      'requester',
      'instructions',
      'reason',
      'reasonCondition',
      'notes',
    ]) {
      await page.getByTestId('add-option-button').click();
      await page.getByTestId(`menu-add-planned-care-${field}`).click();
      await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
    }
    await page
      .getByTestId('planned-care-planned-date-picker')
      .locator('input')
      .fill('2099-03-14');
    await page
      .getByTestId('planned-care-requester-input')
      .fill('Dr. Leonard McCoy');
    // Relative timing stays as the original wording; no date is inferred.
    const instructions =
      'Fast for 8 hours beforehand.\nBook within 2 weeks of this visit.\nBring previous scans.';
    await page
      .getByTestId('planned-care-instructions-input')
      .fill(instructions);
    await page
      .getByTestId('planned-care-reason-input')
      .fill('Right upper pain');
    await page.getByTestId('planned-care-condition-search-input').click();
    await page
      .getByTestId(`planned-care-condition-autocomplete-item-${condition.id}`)
      .click();
    await page
      .getByTestId('planned-care-notes-input')
      .fill('Referral letter given.');

    await checkA11y(page, { include: '[data-testid="planned-care-form"]' });
    await page.getByTestId('save-planned-care-button').click();

    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByTestId('home-planned-care-section')).toBeVisible();
    await page
      .getByRole('button', { name: 'View planned care: Abdominal ultrasound' })
      .click();
    await expect(page.getByTestId('planned-care-title')).toHaveText(
      'Abdominal ultrasound'
    );
    await expect(page.getByTestId('planned-care-category')).toContainText(
      'Imaging'
    );
    await expect(page.getByTestId('planned-care-intent')).toContainText(
      'Order'
    );
    await expect(page.getByTestId('planned-care-requester')).toContainText(
      'Dr. Leonard McCoy'
    );
    await expect(page.getByTestId('planned-care-planned-date')).toContainText(
      '2099'
    );
    await expect(page.getByTestId('planned-care-instructions')).toHaveText(
      instructions
    );
    await expect(page.getByTestId('planned-care-reason')).toHaveText(
      'Right upper pain'
    );
    await expect(
      page.getByTestId('planned-care-reason-conditions-section')
    ).toContainText('Gallstones');
    await expect(page.getByTestId('planned-care-notes')).toHaveText(
      'Referral letter given.'
    );

    const id = page.url().split('/').pop()!;
    const stored = await getTestPlannedCare(page, id);
    expect(stored.resourceType).toBe('ServiceRequest');
    expect(stored.code).toEqual({ concept: { text: 'Abdominal ultrasound' } });
    expect(stored.category).toEqual([
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '363679005',
            display: 'Imaging',
          },
        ],
      },
    ]);
    expect(stored.occurrenceDateTime).toBe('2099-03-14');
    expect(stored.patientInstruction).toEqual([
      { instructionMarkdown: instructions },
    ]);
    expect(stored.reason).toEqual([
      { concept: { text: 'Right upper pain' } },
      { reference: { reference: `Condition/${condition.id}` } },
    ]);
    expect(stored.encounter).toBeUndefined();

    // Planned investigations never create results.
    const results = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT (SELECT COUNT(*) FROM diagnostic_reports) + (SELECT COUNT(*) FROM observations) AS n;'
      )
    );
    expect(results[0].n).toBe(0);
  });

  test('creates planned care from a consultation as its origin', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Gastroenterology review',
      doctorName: 'Dr. Julian Bashir',
    });
    await page.goto(`/consultation/${consultation.id}`);
    await page.getByTestId('consultation-add-treatment').click();
    await page.getByTestId('option-create-new-planned-care').click();
    await expect(page).toHaveURL(
      new RegExp(`.*planned-care\\/add\\?consultationId=${consultation.id}`)
    );

    await page.getByTestId('planned-care-title-input').fill('Colonoscopy');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-planned-care-instructions').click();
    await expect(page.getByTestId('planned-care-requester-input')).toHaveValue(
      'Dr. Julian Bashir'
    );
    await page
      .getByTestId('planned-care-instructions-input')
      .fill('Repeat in 3 months.');
    await page.getByTestId('save-planned-care-button').click();

    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}$`)
    );
    await expect(
      page.getByTestId('consultation-planned-care').getByText('Colonoscopy')
    ).toBeVisible();

    const rows = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT * FROM service_requests WHERE display_label = ?;',
        ['Colonoscopy']
      )
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].consultation_id).toBe(consultation.id);
    const created = JSON.parse(rows[0].fhir_json);
    expect(created.encounter).toEqual({
      reference: `Encounter/${consultation.id}`,
    });
    expect(created.occurrenceDateTime).toBeUndefined();
    const section = findPlannedCareSection(
      await getTestClinicalDocument(page, consultation.id)
    );
    expect(section.code.coding[0]).toEqual({
      system: 'http://loinc.org',
      code: '18776-5',
      display: 'Plan of care note',
    });
    expect(section.entry).toEqual([
      { reference: `ServiceRequest/${created.id}` },
    ]);
  });

  test('creates planned care from a condition, associated with it', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Hypertension' });
    await page.goto(`/condition/${condition.id}`);
    await page.getByTestId('condition-add-button').click();
    await page.getByTestId('menu-add-planned-care').click();
    await page
      .getByTestId('planned-care-title-input')
      .fill('Ambulatory blood pressure monitoring');
    await page.getByTestId('save-planned-care-button').click();

    await expect(page).toHaveURL(new RegExp(`.*condition\\/${condition.id}$`));
    await expect(
      page
        .getByTestId('condition-planned-care-section')
        .getByText('Ambulatory blood pressure monitoring')
    ).toBeVisible();
  });
});
