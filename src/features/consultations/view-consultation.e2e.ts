import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestTreatment,
  getTestTreatment,
  getTestClinicalDocument,
  findTreatmentsSection,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('View Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('opens from Home, edits, and deletes a consultation', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-view-home-flow',
      title: 'Annual Physical Exam',
      doctorName: 'Dr. Beverly Crusher',
      serviceType: 'Primary care',
      date: '2026-10-02',
      notes: 'Follow-up next year.',
      status: 'completed',
    });
    await page.reload();

    await page.getByTestId(`consultation-card-${consultation.id}`).click();
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

    await page.getByTestId('edit-consultation-button').click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}\\/edit`)
    );
    await page.getByTestId('consultation-title-input').fill('Updated Physical');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}$`)
    );
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Updated Physical'
    );

    await expect(page.getByTestId('delete-consultation-button')).toHaveCount(0);
    await page.getByTestId('edit-consultation-button').click();
    await page.getByTestId('delete-consultation-button').click();
    const modal = page.getByTestId('delete-confirmation-modal');
    await expect(modal).toBeVisible();
    await page.getByTestId('delete-modal-cancel-button').click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByTestId('consultation-title-input')).toHaveValue(
      'Updated Physical'
    );

    await page.clock.install();
    await page.getByTestId('delete-consultation-button').click();
    const confirmButton = page.getByTestId('delete-modal-confirm-button');
    await expect(confirmButton).toHaveAttribute('aria-disabled', 'true');
    await page.clock.runFor(5000);
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(
      page.getByTestId(`consultation-card-${consultation.id}`)
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByTestId(`consultation-card-${consultation.id}`)
    ).toHaveCount(0);
  });

  test('opens from Condition and can navigate back to the related condition', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      id: 'condition-consultation-navigation',
      title: 'Knee Osteoarthritis',
      status: 'active',
    });
    const consultation = await seedTestConsultation(page, {
      id: 'consultation-condition-navigation',
      conditionIds: [condition.id],
      title: 'Orthopedic Review',
      doctorName: 'Dr. Sarah Connor',
      date: '2026-10-04',
      status: 'completed',
    });
    await page.reload();

    await page.getByTestId(`condition-card-${condition.id}`).click();
    await page
      .getByTestId(`condition-consultation-item-${consultation.id}`)
      .click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/${consultation.id}$`)
    );
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Orthopedic Review'
    );

    await page.getByTestId('consultation-diagnosis-condition').click();
    await expect(page).toHaveURL(new RegExp(`.*condition\\/${condition.id}$`));
    const conditionView = page
      .getByTestId('condition-view')
      .filter({ visible: true });
    await expect(conditionView.getByTestId('condition-title')).toHaveText(
      'Knee Osteoarthritis'
    );
    await page.getByTestId('back-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
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
    await page.reload();
    await page.getByTestId(`condition-card-${condition.id}`).click();
    await expect(
      page.getByTestId(`condition-consultation-item-${consultation.id}`)
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
      .getByTestId(`condition-consultation-item-${consultation.id}`)
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

    await page.goto(`/consultation/${consultation.id}`);
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Cardiology Follow-up'
    );
    await expect(page.getByTestId('consultation-no-treatments')).toBeVisible();

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
    await expect(page.getByTestId('consultation-no-treatments')).toBeVisible();

    // The last entry is gone, so the empty section is removed too
    const docAfterUnlink = await getTestClinicalDocument(page, consultation.id);
    expect(findTreatmentsSection(docAfterUnlink)).toBeUndefined();

    expect(await getTestTreatment(page, treatment.id)).toBeTruthy();
    await page.goto('/');
    await expect(page.getByText('Lisinopril 10mg')).toBeVisible();
  });
});
