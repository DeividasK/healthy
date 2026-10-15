import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestPlannedCare,
  getTestPlannedCare,
  getTestClinicalDocument,
  findPlannedCareSection,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

test.describe('Edit Service Request', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('edits fields, keeps unexposed data and labels uncommon codes', async ({
    page,
  }) => {
    const request = await seedTestPlannedCare(page, {
      title: 'Blood panel',
      category: '108252007',
      instructions: 'Fasting sample.',
      plannedDate: '2099-01-05',
    });
    // Unexposed fields and uncommon codes from another source.
    await bridge(
      page,
      async (b, id) => {
        const stored = await b.getPlannedCare(id);
        await b.savePlannedCare(
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

    await page.goto(`/planned-care/${request.id}`);
    await expect(page.getByTestId('planned-care-intent')).toContainText(
      'Directive'
    );
    await page.getByTestId('edit-planned-care-button').click();
    await expect(page.getByTestId('planned-care-status-select')).toHaveValue(
      'draft'
    );
    await page
      .getByTestId('planned-care-title-input')
      .fill('Comprehensive metabolic panel');
    await page
      .getByTestId('planned-care-status-select')
      .selectOption('completed');
    await page.getByTestId('remove-planned-care-plannedDate-button').click();
    await page.getByTestId('save-planned-care-button').click();

    await expect(page.getByTestId('planned-care-title')).toHaveText(
      'Comprehensive metabolic panel'
    );
    const stored = await getTestPlannedCare(page, request.id);
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
    const request = await seedTestPlannedCare(page, {
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
          await b.setPlannedCareConsultationRole(
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

    await page.goto(`/planned-care/${request.id}/edit`);
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
    await page.getByTestId('save-planned-care-button').click();

    await expect(
      page
        .getByTestId('planned-care-origin-consultation')
        .getByText('Specialist review')
    ).toBeVisible();
    await expect(
      page.getByTestId(`linked-consultation-${first.id}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`based-on-consultation-${followUp.id}`)
    ).toBeVisible();

    const stored = await getTestPlannedCare(page, request.id);
    expect(stored.encounter).toEqual({ reference: `Encounter/${second.id}` });
    for (const consultation of [first, second])
      expect(
        findPlannedCareSection(
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
      findPlannedCareSection(await getTestClinicalDocument(page, followUp.id))
    ).toBeUndefined();

    // Unlinking every consultation clears the origin and all references.
    await page.getByTestId('edit-planned-care-button').click();
    await page.getByTestId('remove-link-consultation-button').click();
    await page.getByTestId('save-planned-care-button').click();
    await expect(page.getByTestId('planned-care-title')).toBeVisible();
    await expect(
      page.getByTestId('planned-care-origin-consultation')
    ).toHaveCount(0);
    const cleared = await getTestPlannedCare(page, request.id);
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
    const request = await seedTestPlannedCare(page, { title: 'Iron studies' });

    await page.goto(`/condition/${condition.id}/edit`);
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-planned-care').click();
    await page.getByTestId('link-planned-care-search-input').click();
    await page
      .getByTestId(`link-planned-care-autocomplete-item-${request.id}`)
      .click();
    await page.getByTestId('save-button').click();
    await expect(
      page.getByTestId(`condition-planned-care-count-${condition.id}`)
    ).toBeVisible();
    await page.goto(`/condition/${condition.id}`);
    await expect(
      page.getByTestId(`condition-planned-care-item-${request.id}`)
    ).toBeVisible();
    expect((await getTestPlannedCare(page, request.id)).reason).toEqual([
      { reference: { reference: `Condition/${condition.id}` } },
    ]);

    await page.goto(`/planned-care/${request.id}/edit`);
    await page
      .getByTestId('remove-planned-care-reasonCondition-button')
      .click();
    await page.getByTestId('save-planned-care-button').click();
    await expect(
      page.getByTestId('planned-care-reason-conditions-section')
    ).toHaveCount(0);
    expect((await getTestPlannedCare(page, request.id)).reason).toBeUndefined();
  });
});
