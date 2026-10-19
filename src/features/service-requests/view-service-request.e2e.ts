import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  seedTestServiceRequest,
  seedTestReport,
  getTestClinicalDocument,
  findServiceRequestSection,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

test.describe('View Service Request', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('keeps long instructions across reloads', async ({ page }) => {
    const instructions = Array.from(
      { length: 8 },
      (_, i) => `${i + 1}. Step ${i + 1} of the preparation, exactly as given.`
    ).join('\n');
    const request = await seedTestServiceRequest(page, {
      title: 'MRI of the lumbar spine',
      instructions,
    });
    await page.goto(`/service-request/${request.id}`);
    await expect(page.getByTestId('service-request-instructions')).toHaveText(
      instructions
    );
    await page.reload();
    await expect(page.getByTestId('service-request-instructions')).toHaveText(
      instructions
    );
  });

  test('records a consultation based on it and lists both ways', async ({
    page,
  }) => {
    const request = await seedTestServiceRequest(page, {
      title: 'Dermatology referral',
      category: '3457005',
    });
    await page.goto(`/service-request/${request.id}`);
    await page.getByTestId('service-request-add-button').click();
    await page.getByTestId('menu-add-consultation').click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation\\/add\\?basedOnId=${request.id}`)
    );
    await page
      .getByTestId('consultation-title-input')
      .fill('Dermatology appointment');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/consultation\/add/);

    const [consultation] = await bridge(page, (b) =>
      b.querySql(
        "SELECT id, fhir_json FROM consultations WHERE title = 'Dermatology appointment';"
      )
    );
    expect(JSON.parse(consultation.fhir_json).basedOn).toEqual([
      { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
    ]);

    await page.goto(`/consultation/${consultation.id}`);
    await page
      .getByTestId('consultation-based-on')
      .getByText('Dermatology referral')
      .click();
    await expect(page).toHaveURL(new RegExp(`service-request/${request.id}$`));
    await expect(
      page.getByTestId(`based-on-consultation-${consultation.id}`)
    ).toBeVisible();
  });

  test('deleting removes document entries and basedOn references', async ({
    page,
  }) => {
    const origin = await seedTestConsultation(page, { title: 'GP visit' });
    const request = await seedTestServiceRequest(page, {
      title: 'Echocardiogram',
      consultationId: origin.id,
    });
    const visit = await seedTestConsultation(page, {
      title: 'Echo appointment',
      basedOnServiceRequestIds: [request.id],
    });
    const { report } = await seedTestReport(page, {
      serviceRequestIds: [request.id],
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });

    await page.goto(`/service-request/${request.id}`);
    await page.clock.install();
    await page.getByTestId('delete-service-request-button').click();
    await expect(page.getByTestId('delete-confirmation-modal')).toBeVisible();
    await page.clock.runFor(5000);
    await page.getByTestId('delete-modal-confirm-button').click();
    await expect(page.getByTestId('home-consultations-section')).toBeVisible();
    await expect(page.getByTestId('home-service-requests-section')).toHaveCount(
      0
    );

    expect(
      findServiceRequestSection(await getTestClinicalDocument(page, origin.id))
    ).toBeUndefined();
    const stored = await bridge(
      page,
      (b, id) => b.getConsultation(id),
      visit.id
    );
    expect(stored.basedOn).toBeUndefined();
    expect(stored.meta.lastUpdated).toBeTruthy();
    const [row] = await bridge(
      page,
      (b, id) =>
        b.querySql('SELECT fhir_json FROM diagnostic_reports WHERE id = ?;', [
          id,
        ]),
      report.id
    );
    expect(JSON.parse(row.fhir_json).basedOn).toBeUndefined();
  });

  test('is not shown to another profile', async ({ page }) => {
    const request = await seedTestServiceRequest(page, {
      title: 'Allergy test',
    });
    const other = await seedTestPatient(page, {
      id: 'other-patient',
      givenName: 'Jane',
    });
    await bridge(page, (b, id) => b.setActivePatient(id), other.id);
    await page.goto(`/service-request/${request.id}`);
    await expect(page.getByTestId('service-request-view')).toContainText(
      'Service request not found.'
    );
    await page.goto('/');
    await expect(page.getByTestId('home-service-requests-section')).toHaveCount(
      0
    );
  });
});
