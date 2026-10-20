import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  getTestTreatment,
  getTestClinicalDocument,
  findTreatmentsSection,
  checkA11y,
  openRoute,
} from '@/src/features/testing/testStorage';

test.describe('View Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('shows a consultation from its condition and deletes it back to the condition', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      title: 'Migraine Study',
    });
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-view-delete',
      conditionIds: [condition.id],
      title: 'Annual Physical Exam',
      doctorName: 'Dr. Beverly Crusher',
      serviceType: 'Primary care',
      date: '2026-10-02',
      notes: 'Follow-up next year.',
      status: 'completed',
    });
    await page.getByTestId(`condition-open-${condition.id}`).click();
    await page
      .getByTestId(`condition-timeline-item-consultation-${consultation.id}`)
      .click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}$`)
    );
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Annual Physical Exam'
    );
    const view = page.getByTestId('consultation-view');
    await expect(view.getByText('Dr. Beverly Crusher')).toBeVisible();
    await expect(view.getByText('Primary care')).toBeVisible();
    await expect(view.getByText('Follow-up next year.')).toBeVisible();
    await checkA11y(page, { include: '[data-testid="consultation-view"]' });

    await page.clock.install();
    await page.getByTestId('delete-consultation-button').click();
    await expect(page.getByText('Delete Consultation')).toBeVisible();
    await page.clock.runFor(5000);
    await page.getByTestId('delete-modal-confirm-button').click();
    // Deleting returns to the condition, whose timeline is now empty.
    await expect(page).toHaveURL(new RegExp(`.*condition\\/${condition.id}$`));
    await expect(page.getByTestId('condition-title')).toHaveText(
      'Migraine Study'
    );
    await expect(page.getByTestId('condition-timeline')).toHaveCount(0);

    const deletions = await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      await bridge.flushLocalChanges();
      return await bridge.querySql(
        "SELECT resource_id FROM sync_changes WHERE resource_type = 'Encounter' AND op = 'delete'"
      );
    });
    expect(deletions).toEqual([{ resource_id: consultation.id }]);
  });

  test('keeps consultation details available when the linked condition fails to load', async ({
    page,
    consoleMonitor,
  }) => {
    const condition = await seedTestCondition(page, {
      id: 'condition-unreadable',
      title: 'Unreadable condition',
    });
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-readable',
      conditionIds: [condition.id],
      title: 'Available consultation',
      doctorName: 'Dr. Sarah Connor',
      notes: 'Consultation notes remain available.',
    });
    await page.getByTestId(`condition-open-${condition.id}`).click();
    await expect(
      page.getByTestId(
        `condition-timeline-item-consultation-${consultation.id}`
      )
    ).toBeVisible();
    // Invalid FHIR JSON makes only the linked-condition lookup throw.
    await page.evaluate(async (conditionId) => {
      await (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        'UPDATE conditions SET fhir_json = ? WHERE id = ?;',
        ['invalid-json', conditionId]
      );
    }, condition.id);
    consoleMonitor.ignore('Failed to load related condition:');

    await page
      .getByTestId(`condition-timeline-item-consultation-${consultation.id}`)
      .click();
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Available consultation'
    );
    const view = page.getByTestId('consultation-view');
    await expect(view.getByText('Dr. Sarah Connor')).toBeVisible();
    await expect(
      view.getByText('Consultation notes remain available.')
    ).toBeVisible();
    await expect(view.getByText('Failed to load consultation.')).toHaveCount(0);
    await expect(
      page.getByTestId('consultation-diagnosis-condition')
    ).toHaveCount(0);
    await expect(page.getByTestId('edit-consultation-button')).toBeEnabled();
  });

  test('links and unlinks an existing treatment from the edit form without changing its origin', async ({
    page,
  }) => {
    const treatment = await seedTestTreatment(page, {
      title: 'Lisinopril 10mg',
      intent: 'plan',
      status: 'active',
      dosageInstructions: 'Take 1 tablet daily every morning.',
    });
    const consultation = await seedTestConsultation(page, {
      title: 'Cardiology Follow-up',
      doctorName: 'Dr. Leonard McCoy',
      serviceType: 'Cardiology',
    });

    await openRoute(page, `/consultation/${consultation.id}`);
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Cardiology Follow-up'
    );
    await expect(page.getByTestId('consultation-treatments')).toHaveCount(0);

    // + only creates; linking happens in the edit form
    await page.getByTestId('consultation-add-treatment').click();
    await expect(page.getByTestId('option-create-new-treatment')).toBeVisible();
    await expect(
      page.getByTestId('option-link-existing-treatment')
    ).toHaveCount(0);
    await page.getByTestId('consultation-add-treatment').click();
    await page.getByTestId('edit-consultation-button').click();
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-link-treatment').click();
    await page.getByTestId('link-treatment-search-input').click();
    await page
      .getByTestId(`link-treatment-autocomplete-item-${treatment.id}`)
      .click();
    await page.getByTestId('save-button').click();

    const row = page.getByTestId(`consultation-treatment-${treatment.id}-row`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Lisinopril 10mg');
    await expect(row).toContainText('Active');

    const doc = await getTestClinicalDocument(page, consultation.id);
    expect(doc.author).toEqual([{ reference: consultation.subject.reference }]);
    expect(findTreatmentsSection(doc).entry).toContainEqual({
      reference: `MedicationRequest/${treatment.id}`,
    });
    // Linking never rewrites where the treatment originated
    expect(
      (await getTestTreatment(page, treatment.id)).encounter
    ).toBeUndefined();

    await page.getByTestId('edit-consultation-button').click();
    await expect(
      page.getByTestId(`link-selected-treatment-${treatment.id}`)
    ).toBeVisible();
    await page.getByTestId('link-remove-treatment-button').click();
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('consultation-treatments')).toHaveCount(0);

    // The last entry is gone, so the empty section is removed too
    const docAfterUnlink = await getTestClinicalDocument(page, consultation.id);
    expect(findTreatmentsSection(docAfterUnlink)).toBeUndefined();

    expect(await getTestTreatment(page, treatment.id)).toBeTruthy();
    await openRoute(page, '/');
    await expect(page.getByText('Lisinopril 10mg')).toBeVisible();
  });
});
