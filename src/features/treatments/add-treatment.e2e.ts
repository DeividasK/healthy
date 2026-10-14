import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  getTestTreatment,
  findTreatmentsSection,
  getTestClinicalDocument,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Add Treatment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
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
    await page
      .getByTestId('treatment-reason-condition-select')
      .selectOption(condition.id);
    await page
      .getByTestId('treatment-notes-input')
      .fill('Patient reported no penicillin allergies.');

    await checkA11y(page, { include: '[data-testid="treatment-form"]' });
    await page.getByTestId('save-treatment-button').click();

    // Returns to Home, which lists the treatment
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await page.getByText('Amoxicillin 500mg Capsule').click();
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Amoxicillin 500mg Capsule'
    );
    await expect(page.getByTestId('treatment-intent')).toContainText(
      'Prescription / Order'
    );
    await expect(page.getByTestId('treatment-instructions')).toContainText(
      'Complete full course.'
    );
    // Wording and the linked Condition are both shown
    await expect(page.getByTestId('treatment-reason-section')).toContainText(
      'Acute bacterial sinusitis'
    );
    await expect(
      page.getByTestId('treatment-reason-condition-section')
    ).toContainText('Acute sinusitis');
    await expect(page.getByTestId('treatment-notes-section')).toContainText(
      'Patient reported no penicillin allergies.'
    );

    const id = page.url().split('/').pop()!;
    const stored = await getTestTreatment(page, id);
    expect(stored.reason).toEqual([
      {
        concept: { text: 'Acute bacterial sinusitis' },
        reference: { reference: `Condition/${condition.id}` },
      },
    ]);
    expect(stored.text.status).toBe('generated');
    expect(stored.text.div).toContain('Amoxicillin 500mg Capsule');
  });

  test('creates a treatment from a consultation and keeps it when the consultation is deleted', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Neurology Consultation',
      doctorName: 'Dr. Julian Bashir',
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
    await page
      .getByTestId('treatment-documenter-input')
      .fill('Actual documenter');
    await page
      .getByTestId('treatment-instructions-input')
      .fill('Take 1 tablet at onset of migraine.');
    await page.getByTestId('save-treatment-button').click();

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
    const doc = await getTestClinicalDocument(page, consultation.id);
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
    await page.getByTestId('edit-consultation-button').click();
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
});
