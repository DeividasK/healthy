import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestServiceRequest,
  seedTestReport,
  getTestServiceRequest,
  getTestClinicalDocument,
  findServiceRequestSection,
  evaluateBridge as bridge,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('Edit Service Request', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('edits fields, keeps unexposed data and labels uncommon codes', async ({
    page,
  }) => {
    const request = await seedTestServiceRequest(page, {
      title: 'Blood panel',
      category: '108252007',
      instructions: 'Fasting sample.',
      plannedDate: '2099-01-05',
    });
    // Unexposed fields and uncommon codes from another source.
    await bridge(
      page,
      async (b, id) => {
        const stored = await b.getServiceRequest(id);
        await b.saveServiceRequest(
          {
            ...stored,
            intent: 'directive',
            status: 'draft',
            priority: 'urgent',
            category: [...stored.category, { text: 'Cardiology workup' }],
            code: {
              ...stored.code,
              concept: {
                ...stored.code.concept,
                coding: [{ system: 'http://loinc.org', code: '24323-8' }],
              },
            },
          },
          stored.subject.reference.slice(8)
        );
      },
      request.id
    );

    await openRoute(page, `/service-request/${request.id}`);
    await expect(page.getByTestId('service-request-intent')).toContainText(
      'Directive'
    );
    await page.getByTestId('edit-service-request-button').click();
    await expect(page.getByTestId('service-request-status-select')).toHaveValue(
      'draft'
    );
    await page
      .getByTestId('service-request-title-input')
      .fill('Comprehensive metabolic panel');
    await page
      .getByTestId('service-request-status-select')
      .selectOption('completed');
    await page.getByTestId('remove-service-request-plannedDate-button').click();
    await page.getByTestId('save-service-request-button').click();

    await expect(page.getByTestId('service-request-title')).toHaveText(
      'Comprehensive metabolic panel'
    );
    const stored = await getTestServiceRequest(page, request.id);
    expect(stored.status).toBe('completed');
    expect(stored.intent).toBe('directive');
    expect(stored.priority).toBe('urgent');
    expect(stored.code.concept.coding).toEqual([
      { system: 'http://loinc.org', code: '24323-8' },
    ]);
    // The unchanged category keeps both entries; instructions are untouched.
    expect(stored.category).toHaveLength(2);
    expect(stored.patientInstruction).toEqual([
      { instructionMarkdown: 'Fasting sample.' },
    ]);
    expect(stored.occurrenceDateTime).toBeUndefined();
  });

  test('links consultations with each role and keeps a single origin', async ({
    page,
  }) => {
    const first = await seedTestConsultation(page, {
      title: 'GP visit',
      date: '2026-01-10',
    });
    const second = await seedTestConsultation(page, {
      title: 'Specialist review',
      date: '2026-02-10',
    });
    const followUp = await seedTestConsultation(page, {
      title: 'Cardiology appointment',
      date: '2026-03-10',
    });
    const request = await seedTestServiceRequest(page, {
      title: 'Cardiology referral',
      category: '3457005',
      consultationId: first.id,
    });

    // Linking through search is covered from the consultation side; seeding
    // keeps the list clear of the action dock on short screens.
    await bridge(
      page,
      async (b, { requestId, ids, patientId }) => {
        for (const id of ids)
          await b.setServiceRequestConsultationRole(
            requestId,
            id,
            patientId,
            'planned'
          );
      },
      {
        requestId: request.id,
        ids: [second.id, followUp.id],
        patientId: request.subject.reference.slice(8),
      }
    );

    await openRoute(page, `/service-request/${request.id}/edit`);
    await expect(
      page.getByTestId(`link-consultation-role-${first.id}`)
    ).toHaveValue('origin');
    await expect(
      page.getByTestId(`link-consultation-role-${second.id}`)
    ).toHaveValue('planned');
    // Choosing a second origin moves the previous one to "planned".
    await page
      .getByTestId(`link-consultation-role-${second.id}`)
      .selectOption('origin');
    await expect(
      page.getByTestId(`link-consultation-role-${first.id}`)
    ).toHaveValue('planned');
    await page
      .getByTestId(`link-consultation-role-${followUp.id}`)
      .selectOption('basedOn');
    await page.getByTestId('save-service-request-button').click();

    await expect(
      page
        .getByTestId('service-request-origin-consultation')
        .getByText('Specialist review')
    ).toBeVisible();
    await expect(
      page.getByTestId(`linked-consultation-${first.id}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`based-on-consultation-${followUp.id}`)
    ).toBeVisible();

    const stored = await getTestServiceRequest(page, request.id);
    expect(stored.encounter).toEqual({ reference: `Encounter/${second.id}` });
    for (const consultation of [first, second])
      expect(
        findServiceRequestSection(
          await getTestClinicalDocument(page, consultation.id)
        ).entry
      ).toEqual([{ reference: `ServiceRequest/${request.id}` }]);
    const basedOn = await bridge(
      page,
      (b, id) => b.getConsultation(id),
      followUp.id
    );
    expect(basedOn.basedOn).toEqual([
      { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
    ]);
    expect(
      findServiceRequestSection(
        await getTestClinicalDocument(page, followUp.id)
      )
    ).toBeUndefined();

    // Unlinking every consultation clears the origin and all references.
    await page.getByTestId('edit-service-request-button').click();
    await page.getByTestId('remove-link-consultation-button').click();
    await page.getByTestId('save-service-request-button').click();
    await expect(page.getByTestId('service-request-title')).toBeVisible();
    await expect(
      page.getByTestId('service-request-origin-consultation')
    ).toHaveCount(0);
    const cleared = await getTestServiceRequest(page, request.id);
    expect(cleared.encounter).toBeUndefined();
    expect(
      (await bridge(page, (b, id) => b.getConsultation(id), followUp.id))
        .basedOn
    ).toBeUndefined();
  });

  test('associates and removes conditions from both edit forms', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Anaemia' });
    const request = await seedTestServiceRequest(page, {
      title: 'Iron studies',
    });

    await openRoute(page, `/condition/${condition.id}/edit`);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-service-request').click();
    await page.getByTestId('link-service-request-search-input').click();
    await page
      .getByTestId(`link-service-request-autocomplete-item-${request.id}`)
      .click();
    await page.getByTestId('save-button').click();
    await expect(
      page.getByTestId(`condition-service-request-count-${condition.id}`)
    ).toBeVisible();
    expect((await getTestServiceRequest(page, request.id)).reason).toEqual([
      { reference: { reference: `Condition/${condition.id}` } },
    ]);

    await openRoute(page, `/service-request/${request.id}/edit`);
    await page
      .getByTestId('remove-service-request-reasonCondition-button')
      .click();
    await page.getByTestId('save-service-request-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    await expect
      .poll(async () => (await getTestServiceRequest(page, request.id)).reason)
      .toBeUndefined();
  });

  test('links lab results and lists them on the request and the result', async ({
    page,
  }) => {
    const request = await seedTestServiceRequest(page, {
      title: 'Blood count',
    });
    const { report } = await seedTestReport(page, {
      date: '2026-10-05',
      biomarkers: [{ name: 'Hemoglobin', value: 11.2 }],
    });
    const storedBasedOn = async () =>
      JSON.parse(
        (
          await bridge(
            page,
            (b, id) =>
              b.querySql(
                'SELECT fhir_json FROM diagnostic_reports WHERE id = ?;',
                [id]
              ),
            report.id
          )
        )[0].fhir_json
      ).basedOn;

    await openRoute(page, `/service-request/${request.id}/edit`);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-lab-result').click();
    await page.getByTestId('link-lab-result-search-input').click();
    await page
      .getByTestId(`link-lab-result-autocomplete-item-${report.id}`)
      .click();
    await page.getByTestId('save-service-request-button').click();
    await expect(
      page.getByTestId(`service-request-lab-result-${report.id}`)
    ).toBeVisible();
    expect(await storedBasedOn()).toEqual([
      { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
    ]);

    // The request lists the result, and the result lists the request
    await page.getByTestId(`service-request-lab-result-${report.id}`).click();
    await expect(page.getByTestId('lab-result-title')).toBeVisible();
    await page.getByTestId(`lab-result-service-request-${request.id}`).click();
    // The request opens again on top of itself; the one below is hidden.
    await expect(
      page.getByTestId('service-request-title').filter({ visible: true })
    ).toHaveText('Blood count');

    await openRoute(page, `/service-request/${request.id}/edit`);
    await page.getByTestId('link-remove-lab-result-button').click();
    await page.getByTestId('save-service-request-button').click();
    await expect(page.getByTestId('service-request-title')).toBeVisible();
    await expect(
      page.getByTestId('service-request-lab-results-section')
    ).toHaveCount(0);
    expect(await storedBasedOn()).toBeUndefined();
  });
});
