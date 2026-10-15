import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  getTestServiceRequest,
  getTestClinicalDocument,
  findServiceRequestSection,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Add Service Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('creates a standalone service request from Home with every optional field', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      title: 'Gallstones',
    });
    await page.goto('/');
    await page.getByTestId('floating-add-button').click();
    await page.getByTestId('menu-add-service-request').click();
    await expect(page).toHaveURL(/.*service-request\/add$/);

    await page.getByTestId('save-service-request-button').click();
    await expect(page.getByTestId('service-request-form-error')).toContainText(
      'Service is required'
    );

    await page
      .getByTestId('service-request-title-input')
      .fill('Abdominal ultrasound');
    await page
      .getByTestId('service-request-category-select')
      .selectOption('363679005');
    await page
      .getByTestId('service-request-intent-select')
      .selectOption('order');
    await page
      .getByTestId('service-request-status-select')
      .selectOption('active');

    for (const field of [
      'plannedDate',
      'requester',
      'instructions',
      'reason',
      'reasonCondition',
      'notes',
    ]) {
      await page.getByTestId('add-option-button').click();
      await page.getByTestId(`menu-add-service-request-${field}`).click();
      await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
    }
    await page
      .getByTestId('service-request-planned-date-picker')
      .locator('input')
      .fill('2099-03-14');
    await page
      .getByTestId('service-request-requester-input')
      .fill('Dr. Leonard McCoy');
    // Relative timing stays as the original wording; no date is inferred.
    const instructions =
      'Fast for 8 hours beforehand.\nBook within 2 weeks of this visit.\nBring previous scans.';
    await page
      .getByTestId('service-request-instructions-input')
      .fill(instructions);
    await page
      .getByTestId('service-request-reason-input')
      .fill('Right upper pain');
    await page.getByTestId('service-request-condition-search-input').click();
    await page
      .getByTestId(
        `service-request-condition-autocomplete-item-${condition.id}`
      )
      .click();
    await page
      .getByTestId('service-request-notes-input')
      .fill('Referral letter given.');

    await checkA11y(page, { include: '[data-testid="service-request-form"]' });
    await page.getByTestId('save-service-request-button').click();

    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(
      page.getByTestId('home-service-requests-section')
    ).toBeVisible();
    await page
      .getByRole('button', {
        name: 'View service request: Abdominal ultrasound',
      })
      .click();
    await expect(page.getByTestId('service-request-title')).toHaveText(
      'Abdominal ultrasound'
    );
    await expect(page.getByTestId('service-request-category')).toContainText(
      'Imaging'
    );
    await expect(page.getByTestId('service-request-intent')).toContainText(
      'Order'
    );
    await expect(page.getByTestId('service-request-requester')).toContainText(
      'Dr. Leonard McCoy'
    );
    await expect(
      page.getByTestId('service-request-planned-date')
    ).toContainText('2099');
    await expect(page.getByTestId('service-request-instructions')).toHaveText(
      instructions
    );
    await expect(page.getByTestId('service-request-reason')).toHaveText(
      'Right upper pain'
    );
    await expect(
      page.getByTestId('service-request-reason-conditions-section')
    ).toContainText('Gallstones');
    await expect(page.getByTestId('service-request-notes')).toHaveText(
      'Referral letter given.'
    );

    const id = page.url().split('/').pop()!;
    const stored = await getTestServiceRequest(page, id);
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

  test('creates a service request from a consultation as its origin', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Gastroenterology review',
      doctorName: 'Dr. Julian Bashir',
      date: '2026-03-02',
    });
    await page.goto(`/consultation/${consultation.id}`);
    await page.getByTestId('consultation-add-treatment').click();
    // Menu options name what they add, without verbs.
    await expect(page.getByTestId('option-create-new-treatment')).toHaveText(
      'Treatment'
    );
    await expect(
      page.getByTestId('option-create-new-service-request')
    ).toHaveText('Service Request');
    await page.getByTestId('option-create-new-service-request').click();
    await expect(page).toHaveURL(
      new RegExp(`.*service-request\\/add\\?consultationId=${consultation.id}`)
    );

    await page.getByTestId('service-request-title-input').fill('Colonoscopy');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-service-request-instructions').click();
    await expect(
      page.getByTestId('service-request-requester-input')
    ).toHaveValue('Dr. Julian Bashir');
    await page
      .getByTestId('service-request-instructions-input')
      .fill('Repeat in 3 months.');
    await page.getByTestId('save-service-request-button').click();

    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}$`)
    );
    await expect(
      page.getByTestId('consultation-service-request').getByText('Colonoscopy')
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
    // Date and specialist default to the consultation's.
    expect(created.authoredOn).toBe('2026-03-02');
    expect(created.requester).toEqual({ display: 'Dr. Julian Bashir' });
    const section = findServiceRequestSection(
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

  test('creates a service request from a condition, associated with it', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Hypertension' });
    await page.goto(`/condition/${condition.id}`);
    await page.getByTestId('condition-add-button').click();
    await page.getByTestId('menu-add-service-request').click();
    await page
      .getByTestId('service-request-title-input')
      .fill('Ambulatory blood pressure monitoring');
    await page.getByTestId('save-service-request-button').click();

    await expect(page).toHaveURL(new RegExp(`.*condition\\/${condition.id}$`));
    await expect(
      page
        .getByTestId('condition-service-request-section')
        .getByText('Ambulatory blood pressure monitoring')
    ).toBeVisible();
  });
});
