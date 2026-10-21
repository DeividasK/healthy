import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  getTestServiceRequest,
  getTestClinicalDocument,
  findServiceRequestSection,
  seedTestReport,
  checkA11y,
  evaluateBridge,
  openRoute,
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
    await openRoute(page, '/');
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

  test('schedules a repeating service request instead of a planned date', async ({
    page,
  }) => {
    await openRoute(page, '/service-request/add');
    await page.getByTestId('service-request-title-input').fill('PRP injection');
    await page
      .getByTestId('service-request-category-select')
      .selectOption('71388002');

    // Schedule details are offered once it repeats; a schedule and a planned
    // date exclude each other.
    await page.getByTestId('add-option-button').click();
    await expect(
      page.getByTestId('menu-add-service-request-count')
    ).toHaveCount(0);
    await page.getByTestId('menu-add-service-request-repeats').click();
    for (const field of ['periodMax', 'count', 'duration', 'timeOfDay']) {
      await page.getByTestId('add-option-button').click();
      await expect(
        page.getByTestId('menu-add-service-request-plannedDate')
      ).toHaveCount(0);
      await page.getByTestId(`menu-add-service-request-${field}`).click();
    }
    await page.getByTestId('service-request-period-input').fill('4');
    await page
      .getByTestId('service-request-period-unit-select')
      .selectOption('wk');
    await page.getByTestId('service-request-period-max-input').fill('2');
    await page.getByTestId('service-request-count-input').fill('3');
    await page.getByTestId('service-request-duration-input').fill('30');
    await page
      .getByTestId('service-request-time-of-day-select')
      .selectOption('HS');
    await page.getByTestId('save-service-request-button').click();
    await expect(page.getByTestId('service-request-form-error')).toHaveText(
      'Up to must be at least the repeat interval'
    );
    await page.getByTestId('service-request-period-max-input').fill('6');
    await checkA11y(page, { include: '[data-testid="service-request-form"]' });
    await page.getByTestId('save-service-request-button').click();

    // Saving returns Home, where the journal now asks for it.
    await expect(page.getByTestId('home-actions-section')).toBeVisible();
    const [{ id }] = await evaluateBridge(page, (b) =>
      b.querySql('SELECT id FROM service_requests')
    );
    await openRoute(page, `/service-request/${id}`);
    await expect(page.getByTestId('service-request-schedule')).toHaveText(
      '3 sessions, every 4–6 weeks'
    );
    await expect(page.getByTestId('service-request-time-of-day')).toHaveText(
      'Bedtime'
    );
    await expect(page.getByTestId('service-request-duration')).toHaveText(
      '30 min'
    );
    const created = await getTestServiceRequest(page, id);
    expect(created.occurrenceDateTime).toBeUndefined();
    expect(created.occurrenceTiming).toEqual({
      repeat: {
        frequency: 1,
        period: 4,
        periodMax: 6,
        periodUnit: 'wk',
        count: 3,
        duration: 30,
        durationUnit: 'min',
        when: ['HS'],
      },
    });

    // Editing keeps timing the form does not show; removing the schedule
    // clears its details and offers the planned date again.
    await evaluateBridge(
      page,
      async (b, requestId: string) => {
        const stored = await b.getServiceRequest(requestId);
        stored.occurrenceTiming.repeat.boundsPeriod = { start: '2026-09-01' };
        await b.saveServiceRequest(stored, stored.subject.reference.slice(8));
      },
      id
    );
    await openRoute(page, `/service-request/${id}/edit`);
    await expect(page.getByTestId('service-request-count-input')).toHaveValue(
      '3'
    );
    await page.getByTestId('service-request-count-input').fill('4');
    await page.getByTestId('remove-service-request-duration-button').click();
    await page.getByTestId('save-service-request-button').click();
    await expect(page.getByTestId('service-request-schedule')).toHaveText(
      '4 sessions, every 4–6 weeks'
    );
    const edited = await getTestServiceRequest(page, id);
    expect(edited.occurrenceTiming.repeat).toMatchObject({
      count: 4,
      boundsPeriod: { start: '2026-09-01' },
    });
    expect(edited.occurrenceTiming.repeat.duration).toBeUndefined();

    await openRoute(page, `/service-request/${id}/edit`);
    await page.getByTestId('remove-service-request-repeats-button').click();
    await expect(page.getByTestId('service-request-count-input')).toHaveCount(
      0
    );
    await page.getByTestId('add-option-button').click();
    await expect(
      page.getByTestId('menu-add-service-request-plannedDate')
    ).toBeVisible();
    await page.getByTestId('form-add-menu').press('Escape');
    await page.getByTestId('save-service-request-button').click();
    await expect(page.getByTestId('service-request-schedule')).toHaveCount(0);
    expect(
      (await getTestServiceRequest(page, id)).occurrenceTiming
    ).toBeUndefined();
  });

  test('creates a service request from a consultation, then deletes it with its references', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Gastroenterology review',
      doctorName: 'Dr. Julian Bashir',
      date: '2026-03-02',
    });
    await openRoute(page, `/consultation/${consultation.id}`);
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

    await test.step('Deleting it removes its document entry and basedOn references', async () => {
      const visit = await seedTestConsultation(page, {
        title: 'Colonoscopy appointment',
        basedOnServiceRequestIds: [created.id],
      });
      const { report } = await seedTestReport(page, {
        serviceRequestIds: [created.id],
        biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
      });
      await openRoute(page, `/service-request/${created.id}`);
      await page.clock.install();
      await page.getByTestId('delete-service-request-button').click();
      await expect(page.getByTestId('delete-confirmation-modal')).toBeVisible();
      await page.clock.runFor(5000);
      await page.getByTestId('delete-modal-confirm-button').click();
      await expect(
        page.getByTestId('home-consultations-section')
      ).toBeVisible();
      await expect(
        page.getByTestId('home-service-requests-section')
      ).toHaveCount(0);

      expect(
        findServiceRequestSection(
          await getTestClinicalDocument(page, consultation.id)
        )
      ).toBeUndefined();
      const stored = await evaluateBridge(
        page,
        (b, id) => b.getConsultation(id),
        visit.id
      );
      expect(stored.basedOn).toBeUndefined();
      expect(stored.meta.lastUpdated).toBeTruthy();
      const [row] = await evaluateBridge(
        page,
        (b, id) =>
          b.querySql('SELECT fhir_json FROM diagnostic_reports WHERE id = ?;', [
            id,
          ]),
        report.id
      );
      expect(JSON.parse(row.fhir_json).basedOn).toBeUndefined();
    });
  });

  test('creates a service request from a condition, associated with it', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Hypertension' });
    await openRoute(page, `/condition/${condition.id}`);
    await page.getByTestId('condition-add-button').click();
    await page.getByTestId('menu-add-service-request').click();
    await page
      .getByTestId('service-request-title-input')
      .fill('Ambulatory blood pressure monitoring');
    await page.getByTestId('save-service-request-button').click();

    await expect(page).toHaveURL(new RegExp(`.*condition\\/${condition.id}$`));
    await expect(
      page
        .getByTestId('condition-timeline')
        .getByText('Ambulatory blood pressure monitoring')
    ).toBeVisible();
  });
});
